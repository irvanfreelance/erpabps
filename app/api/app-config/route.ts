import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("app_config", "read");
  if (g.error) return g.error;
  const sql = getDb();
  return NextResponse.json({ rows: jsonSafe(await sql`SELECT * FROM app_config ORDER BY key`) });
}

export async function PUT(req: Request) {
  const g = await guard("app_config", "config");
  if (g.error) return g.error;
  const { key, value } = await req.json();
  const sql = getDb();
  const rows = jsonSafe(
    await sql`
      INSERT INTO app_config (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      RETURNING *
    `,
  );
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "app_config", fieldChanged: key, valueAfter: { value } });
  return NextResponse.json(rows[0]);
}
