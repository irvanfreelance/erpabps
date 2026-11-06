import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("dashboard", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const roster = await sql`
    SELECT
      COUNT(*) FILTER (WHERE record_status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE record_status = 'draft')::int AS draft,
      COUNT(*) FILTER (WHERE in_payroll = TRUE)::int AS in_payroll
    FROM employees
    WHERE deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR id = ANY(${ids}::bigint[]))
  `;
  const today = await sql`
    SELECT COUNT(*)::int AS n FROM attendances a
    WHERE a.attendance_date = CURRENT_DATE
      AND (${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[]))
  `;
  const runs = await sql`
    SELECT COUNT(*)::int AS n FROM payroll_runs WHERE status IN ('draft', 'calculated', 'reviewed')
  `;
  const kasbon = await sql`
    SELECT COUNT(*)::int AS n FROM cash_advances
    WHERE screening_status = 'submitted'
      AND (${ids}::bigint[] IS NULL OR employee_id = ANY(${ids}::bigint[]))
  `;
  return NextResponse.json(
    jsonSafe({
      roster: roster[0],
      attendancesToday: (today[0] as { n: number }).n,
      openRuns: (runs[0] as { n: number }).n,
      pendingKasbon: (kasbon[0] as { n: number }).n,
    }),
  );
}
