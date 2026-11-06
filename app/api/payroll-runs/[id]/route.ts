import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { approveRun, calculateRun } from "@/lib/hrd/payroll";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("payroll-runs", "read");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const run = await sql`
    SELECT r.*, g.name AS pay_group_name FROM payroll_runs r
    JOIN pay_groups g ON g.id = r.pay_group_id WHERE r.id = ${id}::bigint
  `;
  if (!run[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  const items = await sql`
    SELECT i.id, i.employee_id, e.full_name, i.payable_minutes, i.late_minutes, i.earnings_total, i.deduction_total, i.net_pay
    FROM payroll_items i
    JOIN employees e ON e.id = i.employee_id
    WHERE i.payroll_run_id = ${id}::bigint
      AND (${ids}::bigint[] IS NULL OR i.employee_id = ANY(${ids}::bigint[]))
    ORDER BY e.full_name
  `;
  return NextResponse.json(jsonSafe({ run: run[0], items }));
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const sql = getDb();
  if (body?.action === "approve") {
    const g = await guard("payroll-runs", "approve");
    if (g.error) return g.error;
    const result = await approveRun(sql, id);
    await logAudit({ userId: g.session!.user.id, action: "approve", entityType: "payroll_run", entityId: id });
    return NextResponse.json(result);
  }
  const g = await guard("payroll-runs", "update");
  if (g.error) return g.error;
  const result = await calculateRun(sql, id, g.session!.user.id);
  await logAudit({ userId: g.session!.user.id, action: "calculate", entityType: "payroll_run", entityId: id });
  return NextResponse.json(result);
}
