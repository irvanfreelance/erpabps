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
    SELECT id, pay_group_id, period_start, period_end, status, pay_frequency
    FROM payroll_runs WHERE id = ${runId}::bigint
  `;
  const run = runs[0] as
    | {
        id: string;
        pay_group_id: string;
        period_start: string;
        period_end: string;
        status: string;
        pay_frequency: string;
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

  // Preserve manual_override adjustments before recalculating
  const manualOverrides = (await sql`
    SELECT i.employee_id, d.component_code, d.quantity, d.unit_rate, d.amount
    FROM payroll_item_details d
    JOIN payroll_items i ON i.id = d.payroll_item_id
    WHERE i.payroll_run_id = ${runId}::bigint
      AND d.source_ref = 'manual_override'
  `) as {
    employee_id: string;
    component_code: string;
    quantity: string;
    unit_rate: string;
    amount: string;
  }[];
  const overridesByEmp = new Map<
    string,
    { component_code: string; quantity: number; unit_rate: number; amount: number }[]
  >();
  for (const ov of manualOverrides) {
    const list = overridesByEmp.get(String(ov.employee_id)) ?? [];
    list.push({
      component_code: ov.component_code,
      quantity: Number(ov.quantity),
      unit_rate: Number(ov.unit_rate),
      amount: Number(ov.amount),
    });
    overridesByEmp.set(String(ov.employee_id), list);
  }

  await sql`DELETE FROM payroll_item_details WHERE payroll_item_id IN (
    SELECT id FROM payroll_items WHERE payroll_run_id = ${runId}::bigint
  )`;
  await sql`DELETE FROM payroll_items WHERE payroll_run_id = ${runId}::bigint`;
  await sql`DELETE FROM payroll_run_snapshots WHERE payroll_run_id = ${runId}::bigint`;

  const periodEndIso =
    (run.period_end as unknown) instanceof Date
      ? (run.period_end as unknown as Date).toISOString().slice(0, 10)
      : String(run.period_end).slice(0, 10);
  const periodStartIso =
    (run.period_start as unknown) instanceof Date
      ? (run.period_start as unknown as Date).toISOString().slice(0, 10)
      : String(run.period_start).slice(0, 10);

  for (const emp of employees) {
    const settings = await resolvePayrollSettings(sql, periodEndIso, {
      employeeId: emp.id,
      positionId: emp.position_id,
      locationId: emp.location_id,
      payGroupId: emp.pay_group_id,
    });
    const lateMode = String(settings["attendance.late_deduction_mode"] ?? "none");
    const lateRate = Number(settings["attendance.late_deduction_rate"] ?? 1000);

    const att = (await sql`
      SELECT a.attendance_date, a.late_minutes, a.payable_minutes, a.clock_in_at, a.clock_out_at,
             COALESCE(st.shift_kind, 'regular') AS shift_kind,
             h.id AS holiday_id, h.name AS holiday_name, h.is_sunday,
             EXTRACT(DOW FROM a.attendance_date) AS dow
      FROM attendances a
      LEFT JOIN shift_assignments sa ON sa.id = a.shift_assignment_id
      LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
      LEFT JOIN holidays h ON h.holiday_date = a.attendance_date
      WHERE a.employee_id = ${emp.id}::bigint
        AND a.attendance_date BETWEEN ${periodStartIso}::date AND ${periodEndIso}::date
    `) as {
      attendance_date: string;
      late_minutes: number;
      payable_minutes: number;
      clock_in_at: string | null;
      clock_out_at: string | null;
      shift_kind: string;
      holiday_id: string | null;
      holiday_name: string | null;
      is_sunday: boolean | null;
      dow: number;
    }[];

    let lateMinutes = 0;
    let payableMinutes = 0;
    let holidayWorkDays = 0;
    let attendedDays = 0;
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
      if (row.clock_in_at || Number(row.payable_minutes) > 0) {
        attendedDays += 1;
      }
      // Cek masuk di tanggal merah selain hari Minggu (DOW 0 = Minggu)
      if (row.holiday_id && !row.is_sunday && Number(row.dow) !== 0 && (row.clock_in_at || Number(row.payable_minutes) > 0)) {
        holidayWorkDays += 1;
      }
    }

    const comps = (await sql`
      SELECT DISTINCT ON (sc.id) sc.code, sc.component_type, esc.amount
      FROM employee_salary_components esc
      JOIN salary_components sc ON sc.id = esc.salary_component_id
      WHERE esc.employee_id = ${emp.id}::bigint
        AND esc.effective_from <= ${run.period_end}::date
        AND (esc.effective_until IS NULL OR esc.effective_until > ${run.period_start}::date)
      ORDER BY sc.id, esc.effective_from DESC, esc.id DESC
    `) as { code: string; component_type: string; amount: string }[];

    const details: { code: string; amount: number; qty: number; rate: number }[] = [];
    let earnings = 0;
    let deductions = 0;
    const hours = payableMinutes / 60;
    let hasHourlyComponent = false;

    for (const c of comps) {
      const amount = Number(c.amount);
      switch (c.component_type) {
        case "earning_fixed": {
          details.push({ code: c.code, amount, qty: 1, rate: amount });
          earnings += amount;
          break;
        }
        case "earning_hourly": {
          hasHourlyComponent = true;
          const total = Math.round(amount * hours);
          details.push({ code: c.code, amount: total, qty: Number(hours.toFixed(2)), rate: amount });
          earnings += total;
          break;
        }
        case "earning_daily": {
          const total = Math.round(amount * attendedDays);
          details.push({ code: c.code, amount: total, qty: attendedDays, rate: amount });
          earnings += total;
          break;
        }
        case "deduction": {
          if (amount > 0) {
            details.push({ code: c.code, amount: -amount, qty: 1, rate: amount });
            deductions += amount;
          }
          break;
        }
        case "earning_variable":
        default:
          // Komponen variabel berasal dari lembur / bonus, dilewati di sini
          break;
      }
    }

    if (!hasHourlyComponent && emp.hourly_rate) {
      const rate = Number(emp.hourly_rate);
      const amount = Math.round(rate * hours);
      details.push({ code: "UPAH_JAM", amount, qty: Number(hours.toFixed(2)), rate });
      earnings += amount;
    }

    // Tambahan uang masuk di tanggal merah selain hari Minggu untuk karyawan bulanan (Dinamis dari master settings)
    const holidayRate = Number(settings["holiday.work_bonus_rate"] ?? 50000);
    if (run.pay_frequency === "monthly" && holidayWorkDays > 0 && holidayRate > 0) {
      const holidayTotal = holidayWorkDays * holidayRate;
      details.push({
        code: "INSENTIF_TGL_MERAH",
        amount: holidayTotal,
        qty: holidayWorkDays,
        rate: holidayRate,
      });
      earnings += holidayTotal;
    }

    // Ambil alokasi bonus tambahan dari bonus_pools yang disetujui untuk karyawan ini pada periode payroll
    const bonusAllocs = (await sql`
      SELECT a.component_code, a.amount, a.reason
      FROM bonus_allocations a
      JOIN bonus_pools bp ON bp.id = a.bonus_pool_id
      WHERE a.employee_id = ${emp.id}::bigint
        AND bp.status IN ('calculated', 'approved')
        AND bp.period_start <= ${periodEndIso}::date
        AND bp.period_end >= ${periodStartIso}::date
    `) as { component_code: string; amount: string; reason: string | null }[];

    for (const ba of bonusAllocs) {
      const amt = Number(ba.amount);
      if (amt > 0) {
        details.push({
          code: `BONUS_${ba.component_code.toUpperCase()}`,
          amount: amt,
          qty: 1,
          rate: amt,
        });
        earnings += amt;
      }
    }

    // Hitung Lembur yang sudah di-approve oleh atasan / HR superadmin
    const overtimes = (await sql`
      SELECT id, overtime_date, duration_minutes, payable_hours, flat_rate
      FROM overtime_requests
      WHERE employee_id = ${emp.id}::bigint
        AND status = 'approved'
        AND overtime_date BETWEEN ${periodStartIso}::date AND ${periodEndIso}::date
    `) as { id: string; overtime_date: string; duration_minutes: number; payable_hours: string; flat_rate: string }[];

    let overtimeTotal = 0;
    let overtimeHours = 0;
    for (const ot of overtimes) {
      const hours = Number(ot.payable_hours) || Number(ot.duration_minutes) / 60;
      const rate = Number(ot.flat_rate) || 25000;
      const otAmount = Math.round(hours * rate);
      overtimeTotal += otAmount;
      overtimeHours += hours;
    }
    if (overtimeTotal > 0) {
      details.push({
        code: "LEMBUR",
        amount: overtimeTotal,
        qty: Number(overtimeHours.toFixed(2)),
        rate: Math.round(overtimeTotal / (overtimeHours || 1)),
      });
      earnings += overtimeTotal;
    }

    const kasbon = (await sql`
      SELECT id, installment_amount, override_installment_amount, remaining_amount, interval_unit
      FROM cash_advances
      WHERE employee_id = ${emp.id}::bigint
        AND screening_status = 'passed'
        AND remaining_amount > 0
        AND (
          ${run.pay_frequency} = 'monthly' AND (interval_unit IS NULL OR interval_unit IN ('monthly', 'custom'))
          OR ${run.pay_frequency} = 'weekly' AND interval_unit = 'weekly'
        )
      ORDER BY requested_at
    `) as {
      id: string;
      installment_amount: string;
      override_installment_amount: string | null;
      remaining_amount: string;
      interval_unit: string | null;
    }[];

    if (lateMode !== "none" && lateMinutes > 0 && lateRate > 0) {
      const lateCut = Math.round(lateMinutes * lateRate);
      details.push({ code: "POTONGAN_TELAT", amount: -lateCut, qty: lateMinutes, rate: lateRate });
      deductions += lateCut;
    }

    for (const k of kasbon) {
      // Gunakan nominal override jika sudah disetel oleh Superadmin HR, jika belum gunakan installment_amount awal
      const agreedCut = k.override_installment_amount != null ? Number(k.override_installment_amount) : Number(k.installment_amount);
      const cut = Math.min(agreedCut, Number(k.remaining_amount));
      if (cut <= 0) continue;
      details.push({ code: "KASBON", amount: -cut, qty: 1, rate: cut });
      deductions += cut;
    }

    // Re-apply manual_override adjustments if any existed before recalculation
    const empOverrides = overridesByEmp.get(String(emp.id)) ?? [];
    for (const ov of empOverrides) {
      if (ov.amount >= 0) {
        earnings += ov.amount;
      } else {
        deductions += Math.abs(ov.amount);
      }
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
    for (const ov of empOverrides) {
      await sql`
        INSERT INTO payroll_item_details (payroll_item_id, component_code, quantity, unit_rate, amount, source_ref)
        VALUES (${itemId}::bigint, ${ov.component_code}, ${ov.quantity}, ${ov.unit_rate}, ${ov.amount}, 'manual_override')
      `;
    }

    const payload = JSON.stringify({ settings, lateMode });
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
  const runs = await sql`SELECT status, pay_frequency FROM payroll_runs WHERE id = ${runId}::bigint`;
  const run = runs[0] as { status: string; pay_frequency: string } | undefined;
  if (!run) throw new Error("Run tidak ditemukan");
  if (run.status === "approved" || run.status === "paid") return { frozen: true };

  // Lock status atomically without recalculating (preserves manual_override adjustments)
  const locked = await sql`
    UPDATE payroll_runs
    SET status = 'approved', settings_frozen_at = now()
    WHERE id = ${runId}::bigint AND status IN ('calculated', 'reviewed')
    RETURNING id
  `;
  if (!locked[0]) return { frozen: true };

  // Apply cash_advance_repayments and deduct remaining_amount only upon approval
  const kasbonItems = (await sql`
    SELECT i.id AS item_id, i.employee_id, ABS(d.amount) AS cut_amount
    FROM payroll_item_details d
    JOIN payroll_items i ON i.id = d.payroll_item_id
    WHERE i.payroll_run_id = ${runId}::bigint
      AND d.component_code = 'KASBON'
      AND d.amount < 0
  `) as { item_id: string; employee_id: string; cut_amount: string }[];

  for (const ki of kasbonItems) {
    let remainingToDeduct = Number(ki.cut_amount);
    if (remainingToDeduct <= 0) continue;

    const advances = (await sql`
      SELECT id, remaining_amount
      FROM cash_advances
      WHERE employee_id = ${ki.employee_id}::bigint
        AND screening_status = 'passed'
        AND remaining_amount > 0
        AND (
          ${run.pay_frequency} = 'monthly' AND (interval_unit IS NULL OR interval_unit IN ('monthly', 'custom'))
          OR ${run.pay_frequency} = 'weekly' AND interval_unit = 'weekly'
        )
      ORDER BY requested_at
    `) as { id: string; remaining_amount: string }[];

    for (const adv of advances) {
      if (remainingToDeduct <= 0) break;
      const avail = Number(adv.remaining_amount);
      const deduct = Math.min(remainingToDeduct, avail);
      if (deduct <= 0) continue;
      await sql`
        INSERT INTO cash_advance_repayments (cash_advance_id, payroll_item_id, amount)
        VALUES (${adv.id}::bigint, ${ki.item_id}::bigint, ${deduct})
      `;
      await sql`
        UPDATE cash_advances
        SET remaining_amount = remaining_amount - ${deduct}, updated_at = now()
        WHERE id = ${adv.id}::bigint
      `;
      remainingToDeduct -= deduct;
    }
  }

  return { frozen: false };
}
