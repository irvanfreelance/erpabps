import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  durationMonths: z.number().int().positive(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const g = await guard("contract-stages", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT id, code, name, duration_months, sort_order, is_active FROM contract_stage_options ORDER BY sort_order`;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("contract-stages", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO contract_stage_options (code, name, duration_months, sort_order)
    VALUES (${parsed.data.code}, ${parsed.data.name}, ${parsed.data.durationMonths}, ${parsed.data.sortOrder ?? 0})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, code, name
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "contract_stage", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
