import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET(req: Request) {
  const g = await guard("payslips", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const runId = new URL(req.url).searchParams.get("runId");
  const rows = await sql`
    SELECT i.id, i.payroll_run_id, e.full_name, e.employee_number, i.payable_minutes, i.late_minutes,
           i.earnings_total, i.deduction_total, i.net_pay, r.period_start, r.period_end, r.status
    FROM payroll_items i
    JOIN employees e ON e.id = i.employee_id
    JOIN payroll_runs r ON r.id = i.payroll_run_id
    WHERE (${ids}::bigint[] IS NULL OR i.employee_id = ANY(${ids}::bigint[]))
      AND (${runId}::bigint IS NULL OR i.payroll_run_id = ${runId}::bigint)
    ORDER BY r.period_end DESC, e.full_name
  `;
  return NextResponse.json(jsonSafe({ rows }));
}
