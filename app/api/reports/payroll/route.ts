import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("reports.payroll", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT e.full_name, r.period_start, r.period_end, r.status, i.net_pay, i.late_minutes
    FROM payroll_items i
    JOIN employees e ON e.id = i.employee_id
    JOIN payroll_runs r ON r.id = i.payroll_run_id
    WHERE ${ids}::bigint[] IS NULL OR i.employee_id = ANY(${ids}::bigint[])
    ORDER BY r.period_end DESC
  `;
  return NextResponse.json(jsonSafe({ rows }));
}
