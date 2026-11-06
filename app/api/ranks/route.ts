import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { rankSchema } from "@/lib/validators/employee";

export async function GET() {
  const g = await guard("ranks", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT id, code, name, sort_order FROM ranks WHERE deleted_at IS NULL ORDER BY sort_order, name
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("ranks", "create");
  if (g.error) return g.error;
  const parsed = rankSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO ranks (code, name, sort_order)
    VALUES (${parsed.data.code}, ${parsed.data.name}, ${parsed.data.sortOrder ?? 0})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, deleted_at = NULL, updated_at = now()
    RETURNING id, code, name, sort_order
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "rank", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
