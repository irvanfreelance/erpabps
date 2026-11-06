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
  shiftTemplateId: z.string(),
  workDate: z.string(),
  stationCode: z.string().nullable().optional(),
  dayStatus: z.string().default("work"),
});

export async function GET(req: Request) {
  const g = await guard("schedules", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const month = new URL(req.url).searchParams.get("month");
  const rows = await sql`
    SELECT sa.id, sa.employee_id, e.full_name, sa.work_date, sa.station_code, sa.day_status, sa.is_backup,
           st.code AS shift_code, st.name AS shift_name, st.shift_kind, st.start_time, st.end_time
    FROM shift_assignments sa
    JOIN employees e ON e.id = sa.employee_id
    JOIN shift_templates st ON st.id = sa.shift_template_id
    WHERE (${ids}::bigint[] IS NULL OR sa.employee_id = ANY(${ids}::bigint[]))
      AND (${month}::text IS NULL OR to_char(sa.work_date, 'YYYY-MM') = ${month})
    ORDER BY sa.work_date, e.full_name
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("schedules", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  const tpl = await sql`SELECT shift_kind FROM shift_templates WHERE id = ${parsed.data.shiftTemplateId}::bigint`;
  const backup = (tpl[0] as { shift_kind: string } | undefined)?.shift_kind === "backup";
  const rows = await sql`
    INSERT INTO shift_assignments (
      employee_id, shift_template_id, work_date, station_code, day_status, is_backup, assigned_by
    ) VALUES (
      ${parsed.data.employeeId}::bigint, ${parsed.data.shiftTemplateId}::bigint, ${parsed.data.workDate}::date,
      ${parsed.data.stationCode ?? null}, ${parsed.data.dayStatus}, ${backup}, ${actor}::bigint
    )
    ON CONFLICT (employee_id, work_date) DO UPDATE SET
      shift_template_id = EXCLUDED.shift_template_id,
      station_code = EXCLUDED.station_code,
      day_status = EXCLUDED.day_status,
      is_backup = EXCLUDED.is_backup,
      updated_at = now()
    RETURNING id
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "shift_assignment", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
