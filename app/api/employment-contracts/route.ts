import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  employeeId: z.string(),
  stageOptionId: z.string(),
  sequenceNo: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string(),
});

export async function GET() {
  const g = await guard("contracts", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT c.id, c.sequence_no, c.start_date, c.end_date, c.status, e.full_name, s.name AS stage_name
    FROM employment_contracts c
    JOIN employees e ON e.id = c.employee_id
    JOIN contract_stage_options s ON s.id = c.stage_option_id
    WHERE ${ids}::bigint[] IS NULL OR c.employee_id = ANY(${ids}::bigint[])
    ORDER BY e.full_name, c.sequence_no
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("contracts", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  const rows = await sql`
    INSERT INTO employment_contracts (employee_id, stage_option_id, sequence_no, start_date, end_date, created_by)
    VALUES (
      ${parsed.data.employeeId}::bigint, ${parsed.data.stageOptionId}::bigint, ${parsed.data.sequenceNo},
      ${parsed.data.startDate}::date, ${parsed.data.endDate}::date, ${actor}::bigint
    )
    RETURNING id
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "employment_contract", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
