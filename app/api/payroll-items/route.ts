import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { ownEmployeeId } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET(req: Request) {
  const g = await guard("payslips", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const user = g.session!.user;
  const runId = new URL(req.url).searchParams.get("runId");

  // Aturan Slip Gaji: Atasan (superordinat) & bawahan (subordinat) hanya bisa melihat slip gaji dirinya sendiri sepanjang waktu.
  // Superadmin dapat melihat seluruh slip gaji.
  let targetEmployeeId: string | null = null;
  if (user.role !== "superadmin") {
    targetEmployeeId = user.employeeId ?? (await ownEmployeeId(sql, user));
    if (!targetEmployeeId) {
      return NextResponse.json(jsonSafe({ rows: [] }));
    }
  }

  const rows = await sql`
    SELECT i.id, i.payroll_run_id, i.employee_id, e.full_name, e.employee_number,
           p.name AS position_name, l.name AS location_name,
           i.payable_minutes, i.late_minutes,
           i.earnings_total, i.deduction_total, i.net_pay,
           r.period_start, r.period_end, r.status, g.name AS pay_group_name
    FROM payroll_items i
    JOIN employees e ON e.id = i.employee_id
    JOIN payroll_runs r ON r.id = i.payroll_run_id
    JOIN pay_groups g ON g.id = r.pay_group_id
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE (${targetEmployeeId}::bigint IS NULL OR i.employee_id = ${targetEmployeeId}::bigint)
      AND (${runId}::bigint IS NULL OR i.payroll_run_id = ${runId}::bigint)
    ORDER BY r.period_end DESC, e.full_name
  `;
  return NextResponse.json(jsonSafe({ rows }));
}
