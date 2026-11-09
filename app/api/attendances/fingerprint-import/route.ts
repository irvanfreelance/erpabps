import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { calculateLateMinutes, parseTimeToSeconds } from "@/lib/utils/date-wib";

export async function GET(req: Request) {
  const g = await guard("attendances", "create");
  if (g.error) return g.error;
  if (g.session!.user.role !== "superadmin") {
    return NextResponse.json({ error: "Hanya Superadmin HR yang dapat mengunduh template fingerprint" }, { status: 403 });
  }

  const sql = getDb();
  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type"); // optional: 'dapur', 'outlet', etc.

  // Ambil data real karyawan (prioritaskan karyawan dapur atau aktif)
  const employees = (await sql`
    SELECT e.id, e.full_name, e.employee_number, e.employee_type,
           p.name AS position_name, l.name AS location_name, l.id AS location_id
    FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE e.deleted_at IS NULL
      AND (${typeFilter}::varchar IS NULL OR e.employee_type = ${typeFilter})
    ORDER BY e.employee_type, e.full_name
  `) as {
    id: string;
    full_name: string;
    employee_number: string | null;
    employee_type: string;
    position_name: string | null;
    location_name: string | null;
    location_id: string | null;
  }[];

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ayam Bakar Pucuk Singkong";

  // Sheet 1: Template Import Presensi Fingerprint
  const sheet = wb.addWorksheet("Import_Presensi");

  sheet.columns = [
    { header: "Nomor Karyawan (CW)", key: "employee_number", width: 22 },
    { header: "Nama Karyawan", key: "full_name", width: 30 },
    { header: "Jenis Karyawan", key: "employee_type", width: 16 },
    { header: "Tanggal (YYYY-MM-DD)", key: "date", width: 20 },
    { header: "Jam Masuk (HH:MM)", key: "clock_in", width: 18 },
    { header: "Jam Pulang (HH:MM)", key: "clock_out", width: 18 },
    { header: "Keterangan / Mesin", key: "notes", width: 25 },
  ];

  // Styling Header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF01665A" }, // ABPS Brand primary
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 26;

  // Isi dengan data real karyawan sebagai referensi input siap pakai
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const emp of employees) {
    sheet.addRow({
      employee_number: emp.employee_number || `ID-${emp.id}`,
      full_name: emp.full_name,
      employee_type: emp.employee_type || "dapur",
      date: todayStr,
      clock_in: emp.employee_type === "dapur" ? "07:00" : "08:00",
      clock_out: emp.employee_type === "dapur" ? "15:30" : "17:00",
      notes: "Mesin Fingerprint Dapur Pusat",
    });
  }

  // Border & alignment rows
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "middle" };
      row.getCell("date").numFmt = "@";
      row.getCell("clock_in").numFmt = "@";
      row.getCell("clock_out").numFmt = "@";
    }
  });

  // Sheet 2: Petunjuk Format
  const guideSheet = wb.addWorksheet("Petunjuk");
  guideSheet.columns = [
    { header: "Panduan Pengisian Import Fingerprint", key: "guide", width: 70 },
  ];
  const gH = guideSheet.getRow(1);
  gH.font = { bold: true, color: { argb: "FFFFFFFF" } };
  gH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF01665A" } };

  guideSheet.addRow(["1. Gunakan Nomor Karyawan (CW) atau Nama Karyawan yang sesuai dengan data sistem."]);
  guideSheet.addRow(["2. Format Tanggal: YYYY-MM-DD (contoh: 2026-10-15)."]);
  guideSheet.addRow(["3. Format Jam: HH:MM (contoh: 07:15 atau 16:30 dalam format 24 jam)."]);
  guideSheet.addRow(["4. Untuk karyawan dapur: Jam hadir riil (clock in s/d clock out) otomatis dihitung dan bebas denda telat."]);
  guideSheet.addRow(["5. Jika data tanggal dan karyawan sudah ada, sistem akan otomatis memperbarui jam masuk/keluar (upsert)."]);

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Template_Import_Fingerprint_ABPS.xlsx"',
    },
  });
}

export async function POST(req: Request) {
  const g = await guard("attendances", "create");
  if (g.error) return g.error;
  if (g.session!.user.role !== "superadmin") {
    return NextResponse.json({ error: "Hanya Superadmin HR yang dapat mengimport kehadiran fingerprint" }, { status: 403 });
  }

  const sql = getDb();
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File Excel (.xlsx) wajib diunggah" }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = wb.getWorksheet("Import_Presensi") ?? wb.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "Sheet Excel tidak ditemukan" }, { status: 400 });
  }

  // Ambil peta seluruh karyawan untuk pencocokan cepat
  const allEmployees = (await sql`
    SELECT id, full_name, employee_number, employee_type, location_id, position_id
    FROM employees
    WHERE deleted_at IS NULL
  `) as {
    id: string;
    full_name: string;
    employee_number: string | null;
    employee_type: string;
    location_id: string | null;
    position_id: string | null;
  }[];

  const empByNumber = new Map<string, typeof allEmployees[0]>();
  const empByName = new Map<string, typeof allEmployees[0]>();

  for (const emp of allEmployees) {
    if (emp.employee_number) {
      empByNumber.set(emp.employee_number.trim().toUpperCase(), emp);
    }
    empByName.set(emp.full_name.trim().toLowerCase(), emp);
  }

  const defaultLoc = (await sql`SELECT id, latitude, longitude FROM locations LIMIT 1`)[0] as
    | { id: string; latitude: string; longitude: string }
    | undefined;

  let successCount = 0;
  const errors: string[] = [];

  // Loop setiap baris data (mulai baris 2)
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const rawNumber = String(row.getCell(1).text || "").trim();
    const rawName = String(row.getCell(2).text || "").trim();
    const rawDate = String(row.getCell(4).text || "").trim();
    const rawIn = String(row.getCell(5).text || "").trim();
    const rawOut = String(row.getCell(6).text || "").trim();
    const rawNotes = String(row.getCell(7).text || "").trim();

    // Skip baris kosong
    if (!rawNumber && !rawName && !rawDate) continue;

    // Cari karyawan
    const matchedEmp =
      (rawNumber ? empByNumber.get(rawNumber.toUpperCase()) : null) ||
      (rawName ? empByName.get(rawName.toLowerCase()) : null);

    if (!matchedEmp) {
      errors.push(`Baris ${rowNumber}: Karyawan '${rawNumber || rawName}' tidak ditemukan di database.`);
      continue;
    }

    // Format & validasi tanggal YYYY-MM-DD
    const dateMatch = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!dateMatch) {
      errors.push(`Baris ${rowNumber}: Format tanggal '${rawDate}' tidak valid. Gunakan YYYY-MM-DD.`);
      continue;
    }
    const dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;

    // Parsing jam masuk & pulang
    const parseTime = (timeStr: string) => {
      const m = timeStr.match(/^(\d{1,2}):(\d{1,2})/);
      if (!m) return null;
      return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}:00`;
    };

    const inTime = rawIn ? parseTime(rawIn) : null;
    const outTime = rawOut ? parseTime(rawOut) : null;

    if (!inTime) {
      errors.push(`Baris ${rowNumber}: Jam Masuk wajib diisi (contoh: 07:00).`);
      continue;
    }

    const clockInAt = `${dateStr}T${inTime}+07:00`;
    const clockOutAt = outTime ? `${dateStr}T${outTime}+07:00` : null;

    // Hitung payable minutes
    let payableMinutes = 0;
    if (clockInAt && clockOutAt) {
      payableMinutes = Math.max(
        0,
        Math.round((new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 60000)
      );
    }

    // Hitung denda telat: Karyawan DAPUR tidak ada denda telat
    let lateMinutes = 0;
    if (matchedEmp.employee_type !== "dapur") {
      // Cek shift assignment jika ada, atau default jam kerja
      const sa = (await sql`
        SELECT start_time FROM shift_assignments
        WHERE employee_id = ${matchedEmp.id}::bigint AND work_date = ${dateStr}::date
        LIMIT 1
      `)[0] as { start_time: string } | undefined;

      const expectedStart = sa?.start_time || "08:00:00";
      const actualSec = parseTimeToSeconds(inTime);
      const targetSec = parseTimeToSeconds(expectedStart);
      lateMinutes = calculateLateMinutes(actualSec, targetSec);
    }

    const locId = matchedEmp.location_id || defaultLoc?.id || null;
    const noteText = rawNotes ? `Fingerprint Import: ${rawNotes}` : "Import Mesin Fingerprint";

    // Simpan presensi (UPSERT)
    await sql`
      INSERT INTO attendances (
        employee_id, location_id, attendance_date,
        clock_in_at, clock_out_at, clock_in_lat, clock_in_lng,
        clock_out_lat, clock_out_lng, status, clock_in_status,
        late_minutes, payable_minutes, outside_radius_note, recorded_by
      ) VALUES (
        ${matchedEmp.id}::bigint, ${locId}::bigint, ${dateStr}::date,
        ${clockInAt}::timestamptz, ${clockOutAt}::timestamptz,
        ${defaultLoc?.latitude ?? null}::numeric, ${defaultLoc?.longitude ?? null}::numeric,
        ${defaultLoc?.latitude ?? null}::numeric, ${defaultLoc?.longitude ?? null}::numeric,
        'present', 'valid', ${lateMinutes}, ${payableMinutes},
        ${noteText}, ${g.session!.user.id}::bigint
      )
      ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
        clock_in_at = EXCLUDED.clock_in_at,
        clock_out_at = EXCLUDED.clock_out_at,
        late_minutes = EXCLUDED.late_minutes,
        payable_minutes = EXCLUDED.payable_minutes,
        outside_radius_note = EXCLUDED.outside_radius_note,
        recorded_by = EXCLUDED.recorded_by,
        updated_at = now()
    `;

    successCount++;
  }

  await logAudit({
    userId: g.session!.user.id,
    action: "import_fingerprint_attendances",
    entityType: "attendance",
    valueAfter: { successCount, errorCount: errors.length },
  });

  return NextResponse.json({
    success: true,
    successCount,
    errors,
  });
}
