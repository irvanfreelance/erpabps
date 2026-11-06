import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  shiftKind: z.enum(["regular", "backup"]).default("regular"),
  startTime: z.string(),
  endTime: z.string(),
});

export async function GET() {
  const g = await guard("shift-templates", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT id, code, name, shift_kind, start_time, end_time, late_policy
    FROM shift_templates WHERE deleted_at IS NULL ORDER BY code
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("shift-templates", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const late = parsed.data.shiftKind === "backup" ? "none" : "inherit";
  const sql = getDb();
  const rows = await sql`
    INSERT INTO shift_templates (code, name, shift_kind, start_time, end_time, late_policy)
    VALUES (${parsed.data.code}, ${parsed.data.name}, ${parsed.data.shiftKind}, ${parsed.data.startTime}::time, ${parsed.data.endTime}::time, ${late})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    RETURNING id, code, name, shift_kind
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "shift_template", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
