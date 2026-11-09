import type { SqlClient } from "@/lib/db";

export type BonusBreakdownConfig = {
  poolAmount: number; // Misal 4.000.000
  noLateBonus: number; // Misal 100.000
  lateThresholdMinutes: number; // Ambang telat misal 5 menit (di bawah 5 mnt tetap dapet)
  noLeaveBonus: number; // Misal 100.000 (tidak ada izin/cuti)
  remainderPopulation: "all" | "qualified" | "outlet_only"; // Populasi sisa dibagi rata
  payGroupId?: string | null;
  locationId?: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
};

export async function calculateMonthlyBonusPool(
  sql: SqlClient,
  poolId: string,
  cfg: BonusBreakdownConfig
) {
  // 1. Ambil seluruh karyawan eligible dalam populasi
  const employees = (await sql`
    SELECT e.id, e.full_name, e.pay_group_id, e.location_id
    FROM employees e
    WHERE e.deleted_at IS NULL
      AND e.record_status = 'active'
      AND e.in_payroll = TRUE
      AND (${cfg.payGroupId ?? null}::bigint IS NULL OR e.pay_group_id = ${cfg.payGroupId ?? null}::bigint)
      AND (${cfg.locationId ?? null}::bigint IS NULL OR e.location_id = ${cfg.locationId ?? null}::bigint)
    ORDER BY e.id
  `) as { id: string; full_name: string; pay_group_id: string; location_id: string }[];

  if (employees.length === 0) {
    throw new Error("Tidak ada karyawan aktif yang ditemukan dalam lingkup bonus");
  }

  // 2. Bersihkan alokasi & komponen lama dari pool ini
  await sql`DELETE FROM bonus_allocations WHERE bonus_pool_id = ${poolId}::bigint`;
  await sql`DELETE FROM bonus_pool_components WHERE bonus_pool_id = ${poolId}::bigint`;

  // Catat komponen aturan ke bonus_pool_components
  await sql`
    INSERT INTO bonus_pool_components (bonus_pool_id, code, amount, late_threshold_min, late_compare, remainder_population)
    VALUES
      (${poolId}::bigint, 'no_late', ${cfg.noLateBonus}, ${cfg.lateThresholdMinutes}, 'lt', NULL),
      (${poolId}::bigint, 'no_leave', ${cfg.noLeaveBonus}, NULL, NULL, NULL),
      (${poolId}::bigint, 'remainder', NULL, NULL, NULL, ${cfg.remainderPopulation})
  `;

  // 3. Analisis kehadiran & ketidakhadiran per karyawan dalam rentang periode
  let totalDistributedFixed = 0;
  const allocations: {
    employeeId: string;
    code: string;
    amount: number;
    reason: string;
  }[] = [];

  const qualifiedForRemainder: string[] = [];

  for (const emp of employees) {
    // Total menit telat di periode
    const attStats = (await sql`
      SELECT COALESCE(SUM(late_minutes), 0) AS total_late,
             COUNT(*) FILTER (WHERE status IN ('absent', 'izin', 'sakit')) AS total_absence
      FROM attendances
      WHERE employee_id = ${emp.id}::bigint
        AND attendance_date BETWEEN ${cfg.periodStart}::date AND ${cfg.periodEnd}::date
    `) as { total_late: string; total_absence: string }[];

    const totalLate = Number(attStats[0]?.total_late ?? 0);
    const totalAbsence = Number(attStats[0]?.total_absence ?? 0);

    // Izin / Cuti yang disetujui dari leave_requests
    const leaves = (await sql`
      SELECT COUNT(*) AS leave_count
      FROM leave_requests
      WHERE employee_id = ${emp.id}::bigint
        AND status = 'approved'
        AND start_date <= ${cfg.periodEnd}::date
        AND end_date >= ${cfg.periodStart}::date
    `) as { leave_count: string }[];
    const leaveCount = Number(leaves[0]?.leave_count ?? 0) + totalAbsence;

    let empGotAny = false;

    // Evaluasi Komponen 1: Tanpa Telat (Atau di bawah ambang menit misal < 5 menit)
    // Sesuai user: "total telat menit di bawah 5 menit masih dapet semuanya"
    if (totalLate < cfg.lateThresholdMinutes && cfg.noLateBonus > 0) {
      allocations.push({
        employeeId: emp.id,
        code: "no_late",
        amount: cfg.noLateBonus,
        reason:
          totalLate === 0
            ? "Tepat waktu sempurna (0 menit telat)"
            : `Telat ${totalLate} menit (di bawah ambang ${cfg.lateThresholdMinutes} menit)`,
      });
      totalDistributedFixed += cfg.noLateBonus;
      empGotAny = true;
    }

    // Evaluasi Komponen 2: Tanpa Izin / Cuti
    if (leaveCount === 0 && cfg.noLeaveBonus > 0) {
      allocations.push({
        employeeId: emp.id,
        code: "no_leave",
        amount: cfg.noLeaveBonus,
        reason: "Hadir penuh tanpa izin / cuti",
      });
      totalDistributedFixed += cfg.noLeaveBonus;
      empGotAny = true;
    }

    if (empGotAny) {
      qualifiedForRemainder.push(emp.id);
    }
  }

  // 4. Hitung Sisa Pool dan Bagi Rata
  const remainderAmount = Math.max(0, cfg.poolAmount - totalDistributedFixed);

  // Tentukan populasi penerima sisa
  let remainderRecipients: string[] = [];
  if (cfg.remainderPopulation === "qualified") {
    remainderRecipients = qualifiedForRemainder;
  } else {
    // default 'all'
    remainderRecipients = employees.map((e) => e.id);
  }

  if (remainderAmount > 0 && remainderRecipients.length > 0) {
    const perPersonRemainder = Math.floor(remainderAmount / remainderRecipients.length);
    for (const empId of remainderRecipients) {
      allocations.push({
        employeeId: empId,
        code: "remainder",
        amount: perPersonRemainder,
        reason: `Bagi rata sisa pool Rp${remainderAmount.toLocaleString("id-ID")} kepada ${remainderRecipients.length} orang`,
      });
    }
  }

  // 5. Simpan seluruh alokasi ke database
  for (const alloc of allocations) {
    await sql`
      INSERT INTO bonus_allocations (bonus_pool_id, employee_id, component_code, amount, reason)
      VALUES (${poolId}::bigint, ${alloc.employeeId}::bigint, ${alloc.code}, ${alloc.amount}, ${alloc.reason})
      ON CONFLICT (bonus_pool_id, employee_id, component_code) DO UPDATE SET
        amount = EXCLUDED.amount,
        reason = EXCLUDED.reason
    `;
  }

  // Update status pool menjadi calculated
  await sql`
    UPDATE bonus_pools
    SET status = 'calculated', pool_amount = ${cfg.poolAmount}
    WHERE id = ${poolId}::bigint
  `;

  return {
    totalPool: cfg.poolAmount,
    totalDistributedFixed,
    remainderAmount,
    allocationsCount: allocations.length,
    employeesCount: employees.length,
  };
}

