import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url);

  console.log("=== Memulai Seeding Kehadiran & Payroll Oktober 2026 ===");

  // 1. Pastikan Hari Santri Nasional 22 Okt 2026 masuk ke tabel holidays
  await sql`
    INSERT INTO holidays (holiday_date, name, is_sunday)
    VALUES ('2026-10-22'::date, 'Hari Santri Nasional', FALSE)
    ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name, is_sunday = EXCLUDED.is_sunday
  `;
  console.log("✓ Hari libur 22 Okt 2026 (Hari Santri Nasional) tersimpan.");

  // 2. Ambil data master
  const employees = (await sql`
    SELECT id, full_name, employee_type, in_payroll, record_status, pay_group_id, position_id, location_id
    FROM employees
    WHERE deleted_at IS NULL AND record_status = 'active'
    ORDER BY id
  `) as {
    id: string;
    full_name: string;
    employee_type: string;
    in_payroll: boolean;
    record_status: string;
    pay_group_id: string;
    position_id: string;
    location_id: string;
  }[];
  console.log(`✓ Karyawan aktif yang diproses: ${employees.length} orang.`);

  const shifts = (await sql`
    SELECT id, code, name, start_time, end_time, shift_kind
    FROM shift_templates
  `) as { id: string; code: string; name: string; start_time: string; end_time: string; shift_kind: string }[];
  const shiftByCode = new Map(shifts.map((s) => [s.code, s]));

  const locations = (await sql`
    SELECT id, code, latitude, longitude, radius_meter FROM locations LIMIT 1
  `) as { id: string; code: string; latitude: string; longitude: string; radius_meter: number }[];
  const loc = locations[0] ?? {
    id: "1",
    latitude: "-6.2088",
    longitude: "106.8456",
    radius_meter: 100,
  };

  const users = (await sql`SELECT id FROM users ORDER BY id LIMIT 1`) as { id: string }[];
  const adminUserId = users[0]?.id ?? "1";

  // 3. Bersihkan data kehadiran & jadwal bulan Oktober 2026 sebelum seed ulang
  await sql`DELETE FROM attendances WHERE attendance_date BETWEEN '2026-10-01' AND '2026-10-31'`;
  await sql`DELETE FROM shift_assignments WHERE work_date BETWEEN '2026-10-01' AND '2026-10-31'`;
  await sql`DELETE FROM cash_advance_repayments WHERE cash_advance_id IN (SELECT id FROM cash_advances WHERE notes LIKE '%Seed Oktober 2026%')`;
  await sql`DELETE FROM cash_advances WHERE notes LIKE '%Seed Oktober 2026%'`;
  await sql`DELETE FROM leave_requests WHERE reason LIKE '%Seed Cuti Oktober 2026%'`;
  console.log("✓ Data lama Oktober 2026 dibersihkan.");

  // 4. Buat Kasbon untuk 1-2 karyawan (Misal Karyawan id 1 Vanesa dan Karyawan id 4 Iman)
  // Vanesa: Pinjam 600.000, 3x cicilan @200.000, status passed
  await sql`
    INSERT INTO cash_advances (
      employee_id, amount, installment_count, installment_amount,
      interval_unit, interval_every, remaining_amount, screening_status,
      screened_by, screened_at, notes
    ) VALUES (
      ${employees[0].id}::bigint, 600000, 3, 200000,
      'month', 1, 600000, 'passed',
      ${adminUserId}::bigint, '2026-10-01 10:00:00+07', 'Kasbon renovasi rumah (Seed Oktober 2026)'
    )
  `;
  // Iman: Pinjam 300.000, 2x cicilan @150.000, status passed
  if (employees[3]) {
    await sql`
      INSERT INTO cash_advances (
        employee_id, amount, installment_count, installment_amount,
        interval_unit, interval_every, remaining_amount, screening_status,
        screened_by, screened_at, notes
      ) VALUES (
        ${employees[3].id}::bigint, 300000, 2, 150000,
        'month', 1, 300000, 'passed',
        ${adminUserId}::bigint, '2026-10-02 09:00:00+07', 'Kasbon keperluan darurat keluarga (Seed Oktober 2026)'
      )
    `;
  }
  console.log("✓ Kasbon realistis ter-seed (Vanesa: 3x cicilan, Iman: 2x cicilan).");

  // 5. Buat Pengajuan Cuti Approved untuk 1 Karyawan (Cth: Mohammad Rafly, cuti 2 hari: 14-15 Oktober 2026)
  if (employees[2]) {
    await sql`
      INSERT INTO leave_requests (
        employee_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at
      ) VALUES (
        ${employees[2].id}::bigint, 'annual', '2026-10-14'::date, '2026-10-15'::date,
        'Cuti tahunan keperluan keluarga (Seed Cuti Oktober 2026)', 'approved',
        ${adminUserId}::bigint, '2026-10-10 14:00:00+07'
      )
    `;
  }
  console.log("✓ Pengajuan cuti approved ter-seed (Mohammad Rafly: 14-15 Okt 2026).");

  // 6. Generate Jadwal & Kehadiran Realistis 1 - 31 Oktober 2026
  let totalAttendances = 0;
  let totalSchedules = 0;

  for (let day = 1; day <= 31; day++) {
    const dayStr = String(day).padStart(2, "0");
    const dateStr = `2026-10-${dayStr}`;
    const dateObj = new Date(`${dateStr}T12:00:00+07:00`);
    const dow = dateObj.getDay(); // 0 = Minggu, 1 = Senin, ... 4 = Kamis (22 Okt), ...

    const isHariSantri = day === 22; // Kamis 22 Okt 2026

    for (let empIdx = 0; empIdx < employees.length; empIdx++) {
      const emp = employees[empIdx];

      // Karyawan Cuti pada 14 dan 15 Okt (Mohammad Rafly)
      if (empIdx === 2 && (day === 14 || day === 15)) {
        const offTpl = shiftByCode.get("OFF") ?? shifts[0];
        await sql`
          INSERT INTO shift_assignments (
            employee_id, shift_template_id, work_date, day_status, is_backup,
            start_time, end_time, assigned_by, notes
          ) VALUES (
            ${emp.id}::bigint, ${offTpl.id}::bigint, ${dateStr}::date, 'off_izin', FALSE,
            '00:00:00', '00:00:00', ${adminUserId}::bigint, 'Cuti Tahunan Disetujui'
          )
        `;
        totalSchedules++;
        continue;
      }

      // Karyawan Libur Mingguan bergantian:
      // Misal Minggu (dow === 0): sebagian libur, sebagian masuk (kecuali Hari Santri 22 Okt adalah Kamis, semua roster masuk/kerja)
      const isOffDay = (empIdx % 2 === 0 && dow === 0) || (empIdx % 2 === 1 && dow === 1);
      if (isOffDay && !isHariSantri) {
        const offTpl = shiftByCode.get("OFF") ?? shifts[0];
        await sql`
          INSERT INTO shift_assignments (
            employee_id, shift_template_id, work_date, day_status, is_backup,
            start_time, end_time, assigned_by, notes
          ) VALUES (
            ${emp.id}::bigint, ${offTpl.id}::bigint, ${dateStr}::date, 'off', FALSE,
            '00:00:00', '00:00:00', ${adminUserId}::bigint, 'Libur Mingguan'
          )
        `;
        totalSchedules++;
        continue;
      }

      // Pilih Shift Roster
      // Template variasi: P1 (06:00 - 16:00), P2 (11:30 - 21:30), MID (09:30 - 19:30)
      let shiftCode = "P1";
      if ((day + empIdx) % 3 === 1) shiftCode = "P2";
      else if ((day + empIdx) % 3 === 2) shiftCode = "MID";

      // Khusus salah satu karyawan di hari tertentu coba shift BACKUP
      if (empIdx === 3 && day === 18) {
        shiftCode = "BACKUP";
      }

      const tpl = shiftByCode.get(shiftCode) ?? shifts[0];
      const isBackup = shiftCode === "BACKUP";

      const saRes = await sql`
        INSERT INTO shift_assignments (
          employee_id, shift_template_id, work_date, day_status, is_backup,
          start_time, end_time, assigned_by, notes
        ) VALUES (
          ${emp.id}::bigint, ${tpl.id}::bigint, ${dateStr}::date, 'scheduled', ${isBackup},
          ${tpl.start_time}::time, ${tpl.end_time}::time, ${adminUserId}::bigint, ${isHariSantri ? 'Masuk Hari Santri Nasional' : null}
        ) RETURNING id
      `;
      const saId = (saRes[0] as { id: string }).id;
      totalSchedules++;

      // Tentukan Jam Clock-In dan Clock-Out
      // Variasi:
      // Sebagian tepat waktu (cth: masuk 5 menit lebih awal).
      // Sebagian telat (cth: telat 12 menit, 25 menit) dengan late_reason.
      let lateMinutes = 0;
      let lateReason: string | null = null;

      let inHour = 6;
      let inMinute = 0;
      let outHour = 16;
      let outMinute = 0;

      if (shiftCode === "P1") {
        inHour = 6;
        outHour = 16;
      } else if (shiftCode === "P2") {
        inHour = 11;
        inMinute = 30;
        outHour = 21;
        outMinute = 30;
      } else if (shiftCode === "MID") {
        inHour = 9;
        inMinute = 30;
        outHour = 19;
        outMinute = 30;
      } else if (shiftCode === "BACKUP") {
        inHour = 8;
        inMinute = 0;
        outHour = 17;
        outMinute = 0;
      }

      // Karyawan telat bervariasi:
      // Misal Karyawan 1 (Vanesa) telat di tgl 5 (15 menit) dan tgl 20 (22 menit)
      // Misal Karyawan 4 (Iman) telat di tgl 8 (30 menit) dan tgl 25 (10 menit)
      // Misal Karyawan 5 (Yuli) telat di tgl 12 (18 menit)
      // Karyawan yang shift BACKUP tidak dihitung telat (aturan shift backup)
      if (empIdx === 0 && day === 5) {
        lateMinutes = 15;
        lateReason = "Macet parah di flyover karena perbaikan jalan";
        inMinute += 15;
      } else if (empIdx === 0 && day === 20) {
        lateMinutes = 22;
        lateReason = "Hujan deras dan banjir di perempatan utama";
        inMinute += 22;
      } else if (empIdx === 3 && day === 8) {
        lateMinutes = 30;
        lateReason = "Ban motor kempes di jalan menuju outlet";
        inMinute += 30;
      } else if (empIdx === 3 && day === 25) {
        lateMinutes = 10;
        lateReason = "Antrean panjang di SPBU";
        inMinute += 10;
      } else if (empIdx === 4 && day === 12) {
        lateMinutes = 18;
        lateReason = "Kendala kendaraan mogok";
        inMinute += 18;
      } else if (empIdx === 3 && day === 18 && isBackup) {
        // Shift BACKUP: walaupun jam masuk lewat, late_minutes tetap 0
        inMinute += 20;
        lateMinutes = 0;
      } else {
        // Tepat waktu (datang tepat atau 5-10 menit sebelum jam mulai)
        inMinute = Math.max(0, inMinute - 5);
      }

      // Adjust overflow menit jika lebih dari 60
      if (inMinute >= 60) {
        inHour += Math.floor(inMinute / 60);
        inMinute = inMinute % 60;
      }

      const clockInStr = `${dateStr}T${String(inHour).padStart(2, "0")}:${String(inMinute).padStart(2, "0")}:00+07:00`;
      const clockOutStr = `${dateStr}T${String(outHour).padStart(2, "0")}:${String(outMinute).padStart(2, "0")}:00+07:00`;

      // Hitung payable minutes
      const diffMinutes = Math.round((new Date(clockOutStr).getTime() - new Date(clockInStr).getTime()) / 60000);

      await sql`
        INSERT INTO attendances (
          employee_id, location_id, shift_assignment_id, attendance_date,
          clock_in_at, clock_out_at, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng,
          status, clock_in_status, late_minutes, payable_minutes, late_reason
        ) VALUES (
          ${emp.id}::bigint, ${loc.id}::bigint, ${saId}::bigint, ${dateStr}::date,
          ${clockInStr}::timestamptz, ${clockOutStr}::timestamptz,
          ${loc.latitude}::numeric, ${loc.longitude}::numeric,
          ${loc.latitude}::numeric, ${loc.longitude}::numeric,
          'present', 'valid', ${lateMinutes}, ${diffMinutes}, ${lateReason}
        )
      `;
      totalAttendances++;
    }
  }

  console.log(`✓ Jadwal shift Oktober 2026 dibuat: ${totalSchedules} jadwal.`);
  console.log(`✓ Presensi Oktober 2026 dibuat: ${totalAttendances} kehadiran (termasuk Hari Santri 22 Okt, telat + alasan, cuti, kasbon).`);

  // 7. Buat Payroll Run untuk Bulan Oktober 2026 (Pay Group: MONTHLY_OUTLET, ID = 3)
  const monthlyOutletGroup = (await sql`SELECT id FROM pay_groups WHERE code = 'MONTHLY_OUTLET' LIMIT 1`) as { id: string }[];
  if (monthlyOutletGroup[0]) {
    const pgId = monthlyOutletGroup[0].id;
    const existingRun = (await sql`
      SELECT id FROM payroll_runs
      WHERE pay_group_id = ${pgId}::bigint AND period_start = '2026-10-01'::date AND run_type = 'regular'
    `) as { id: string }[];

    let runId: string;
    if (existingRun[0]) {
      runId = existingRun[0].id;
      console.log(`✓ Payroll Run Oktober 2026 sudah ada (ID: ${runId}).`);
    } else {
      const newRun = (await sql`
        INSERT INTO payroll_runs (
          pay_group_id, period_start, period_end, pay_frequency, status, run_type, created_by
        ) VALUES (
          ${pgId}::bigint, '2026-10-01'::date, '2026-10-31'::date, 'monthly', 'draft', 'regular', ${adminUserId}::bigint
        ) RETURNING id
      `) as { id: string }[];
      runId = newRun[0].id;
      console.log(`✓ Payroll Run Oktober 2026 baru berhasil dibuat (ID: ${runId}).`);
    }
  }

  console.log("=== Seeding Kehadiran & Payroll Oktober 2026 Selesai Sukses ===");
}

run().catch((err) => {
  console.error("Gagal seed Oktober 2026:", err);
  process.exit(1);
});

