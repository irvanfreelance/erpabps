import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({ code: z.string().min(1), name: z.string().min(1) });

export async function GET() {
  const g = await guard("locations", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT id, code, name, created_at FROM locations WHERE deleted_at IS NULL ORDER BY name`;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("locations", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO locations (code, name) VALUES (${parsed.data.code}, ${parsed.data.name})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    RETURNING id, code, name
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "location", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
