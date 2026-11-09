import { createHash } from "node:crypto";
import type { SqlClient } from "@/lib/db";
import { resolvePayrollSettings } from "@/lib/hrd/settings";

type Emp = {
  id: string;
  hourly_rate: string | null;
  daily_rate: string | null;
  position_id: string | null;
  location_id: string | null;
  pay_group_id: string | null;
};

export async function calculateRun(sql: SqlClient, runId: string, actorId: string) {
  const runs = await sql`
    SELECT id, pay_group_id, period_start, period_end, status
    FROM payroll_runs WHERE id = ${runId}::bigint
  `;
  const run = runs[0] as
    | {
        id: string;
        pay_group_id: string;
        period_start: string;
        period_end: string;
        status: string;
      }
    | undefined;
  if (!run) throw new Error("Run tidak ditemukan");
  if (run.status === "approved" || run.status === "paid") {
    return { frozen: true, run };
  }

  const employees = (await sql`
    SELECT id, hourly_rate, daily_rate, position_id, location_id, pay_group_id
    FROM employees
    WHERE deleted_at IS NULL
      AND in_payroll = TRUE
      AND record_status = 'active'
      AND pay_group_id = ${run.pay_group_id}::bigint
  `) as Emp[];

    const oldRepay = (await sql`
    SELECT r.cash_advance_id, r.amount
    FROM cash_advance_repayments r
    JOIN payroll_items i ON i.id = r.payroll_item_id
    WHERE i.payroll_run_id = ${runId}::bigint
  `) as { cash_advance_id: string; amount: string }[];
  for (const r of oldRepay) {
    await sql`
      UPDATE cash_advances
      SET remaining_amount = remaining_amount + ${Number(r.amount)}, updated_at = now()
      WHERE id = ${r.cash_advance_id}::bigint
    `;
  }
  await sql`DELETE FROM cash_advance_repayments WHERE payroll_item_id IN (
    SELECT id FROM payroll_items WHERE payroll_run_id = ${runId}::bigint
  )`;
  await sql`DELETE FROM payroll_item_details WHERE payroll_item_id IN (
    SELECT id FROM payroll_items WHERE payroll_run_id = ${runId}::bigint
  )`;
  await sql`DELETE FROM payroll_items WHERE payroll_run_id = ${runId}::bigint`;
  await sql`DELETE FROM payroll_run_snapshots WHERE payroll_run_id = ${runId}::bigint`;

  for (const emp of employees) {
    const settings = await resolvePayrollSettings(sql, String(run.period_end).slice(0, 10), {
      employeeId: emp.id,
      positionId: emp.position_id,
      locationId: emp.location_id,
      payGroupId: emp.pay_group_id,
    });
    const lateMode = String(settings["attendance.late_deduction_mode"] ?? "none");
    const lateRate = Number(settings["attendance.late_deduction_rate"] ?? 1000);

    const att = (await sql`
      SELECT a.late_minutes, a.payable_minutes, a.clock_in_at, a.clock_out_at,
             COALESCE(st.shift_kind, 'regular') AS shift_kind
      FROM attendances a
      LEFT JOIN shift_assignments sa ON sa.id = a.shift_assignment_id
      LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
      WHERE a.employee_id = ${emp.id}::bigint
        AND a.attendance_date BETWEEN ${run.period_start}::date AND ${run.period_end}::date
    `) as {
      late_minutes: number;
      payable_minutes: number;
      clock_in_at: string | null;
      clock_out_at: string | null;
      shift_kind: string;
    }[];

    let lateMinutes = 0;
    let payableMinutes = 0;
    for (const row of att) {
      const backup = row.shift_kind === "backup";
      lateMinutes += backup || lateMode === "none" ? 0 : Number(row.late_minutes ?? 0);
      if (Number(row.payable_minutes ?? 0) > 0) {
        payableMinutes += Number(row.payable_minutes);
      } else if (row.clock_in_at && row.clock_out_at) {
        payableMinutes += Math.max(
          0,
          Math.round((new Date(row.clock_out_at).getTime() - new Date(row.clock_in_at).getTime()) / 60000),
        );
      }
    }

    const comps = (await sql`
      SELECT sc.code, sc.component_type, esc.amount
      FROM employee_salary_components esc
      JOIN salary_components sc ON sc.id = esc.salary_component_id
      WHERE esc.employee_id = ${emp.id}::bigint
        AND esc.effective_from <= ${run.period_end}::date
        AND (esc.effective_until IS NULL OR esc.effective_until > ${run.period_start}::date)
    `) as { code: string; component_type: string; amount: string }[];

    const details: { code: string; amount: number; qty: number; rate: number }[] = [];
    let earnings = 0;
    for (const c of comps) {
      const amount = Number(c.amount);
      if (c.component_type.startsWith("earning")) {
        details.push({ code: c.code, amount, qty: 1, rate: amount });
        earnings += amount;
      }
    }
    const hours = payableMinutes / 60;
    if (emp.hourly_rate) {
      const rate = Number(emp.hourly_rate);
      const amount = Math.round(rate * hours);
      details.push({ code: "UPAH_JAM", amount, qty: hours, rate });
      earnings += amount;
    }

    const kasbon = (await sql`
      SELECT id, installment_amount, remaining_amount
      FROM cash_advances
      WHERE employee_id = ${emp.id}::bigint
        AND screening_status = 'passed'
        AND remaining_amount > 0
      ORDER BY requested_at
    `) as { id: string; installment_amount: string; remaining_amount: string }[];

    let deductions = 0;
    if (lateMode !== "none" && lateMinutes > 0 && lateRate > 0) {
      const lateCut = Math.round(lateMinutes * lateRate);
      details.push({ code: "POTONGAN_TELAT", amount: -lateCut, qty: lateMinutes, rate: lateRate });
      deductions += lateCut;
    }

    for (const k of kasbon) {
      const cut = Math.min(Number(k.installment_amount), Number(k.remaining_amount));
      if (cut <= 0) continue;
      details.push({ code: "KASBON", amount: -cut, qty: 1, rate: cut });
      deductions += cut;
    }

    const net = earnings - deductions;
    const items = await sql`
      INSERT INTO payroll_items (
        payroll_run_id, employee_id, payable_minutes, late_minutes,
        earnings_total, deduction_total, net_pay
      ) VALUES (
        ${runId}::bigint, ${emp.id}::bigint, ${payableMinutes}, ${lateMinutes},
        ${earnings}, ${deductions}, ${net}
      ) RETURNING id
    `;
    const itemId = String((items[0] as { id: string }).id);
    for (const d of details) {
      await sql`
        INSERT INTO payroll_item_details (payroll_item_id, component_code, quantity, unit_rate, amount, source_ref)
        VALUES (${itemId}::bigint, ${d.code}, ${d.qty}, ${d.rate}, ${d.amount}, 'calculated')
      `;
    }
    for (const k of kasbon) {
      const cut = Math.min(Number(k.installment_amount), Number(k.remaining_amount));
      if (cut <= 0) continue;
      await sql`
        INSERT INTO cash_advance_repayments (cash_advance_id, payroll_item_id, amount)
        VALUES (${k.id}::bigint, ${itemId}::bigint, ${cut})
      `;
      await sql`
        UPDATE cash_advances
        SET remaining_amount = remaining_amount - ${cut}, updated_at = now()
        WHERE id = ${k.id}::bigint
      `;
    }

    const payload = JSON.stringify({ settings, lateMode, actorId });
    const hash = createHash("sha256").update(payload).digest("hex");
    await sql`
      INSERT INTO payroll_run_snapshots (payroll_run_id, employee_id, resolved_settings, settings_hash)
      VALUES (${runId}::bigint, ${emp.id}::bigint, ${payload}::jsonb, ${hash})
    `;
  }

  await sql`UPDATE payroll_runs SET status = 'calculated' WHERE id = ${runId}::bigint AND status IN ('draft', 'calculated', 'reviewed')`;
  return { frozen: false, run };
}

export async function approveRun(sql: SqlClient, runId: string) {
  const runs = await sql`SELECT status FROM payroll_runs WHERE id = ${runId}::bigint`;
  const status = (runs[0] as { status: string } | undefined)?.status;
  if (!status) throw new Error("Run tidak ditemukan");
  if (status === "approved" || status === "paid") return { frozen: true };
  await calculateRun(sql, runId, "approve");
  await sql`
    UPDATE payroll_runs
    SET status = 'approved', settings_frozen_at = now()
    WHERE id = ${runId}::bigint
  `;
  return { frozen: false };
}
