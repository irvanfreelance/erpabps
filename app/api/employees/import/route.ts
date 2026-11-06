import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { allocateEmployeeNumber } from "@/lib/hrd/employee-number";
import {
  buildEmployeeTemplateWorkbook,
  cellStr,
  EMPLOYEE_IMPORT_HEADERS,
  parseGender,
} from "@/lib/utils/employee-template";
import { RE } from "@/lib/validators/common";

type Catalog = { id: string; code: string; name: string };

function indexCatalog(rows: Catalog[]) {
  const byCode = new Map<string, Catalog>();
  const byName = new Map<string, Catalog>();
  for (const r of rows) {
    byCode.set(r.code.trim().toLowerCase(), r);
    byName.set(r.name.trim().toLowerCase(), r);
  }
  return (raw: string) => {
    const k = raw.trim().toLowerCase();
    if (!k) return null;
    return byCode.get(k) ?? byName.get(k) ?? null;
  };
}

export async function GET() {
  const g = await guard("employees", "create");
  if (g.error) return g.error;
  const sql = getDb();
  const [positions, ranks, payGroups, locations, supervisors] = await Promise.all([
    sql`SELECT code, name FROM positions WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT code, name FROM ranks WHERE deleted_at IS NULL ORDER BY sort_order, name`,
    sql`SELECT code, name FROM pay_groups ORDER BY name`,
    sql`SELECT code, name FROM locations WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT employee_number AS code, full_name AS name FROM employees WHERE deleted_at IS NULL AND employee_number IS NOT NULL ORDER BY full_name`,
  ]);
  const buf = await buildEmployeeTemplateWorkbook({
    positions: positions as { code: string; name: string }[],
    ranks: ranks as { code: string; name: string }[],
    payGroups: payGroups as { code: string; name: string }[],
    locations: locations as { code: string; name: string }[],
    supervisors: supervisors as { code: string; name: string }[],
  });
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-karyawan.xlsx"',
    },
  });
}

export async function POST(req: Request) {
  const g = await guard("employees", "create");
  if (g.error) return g.error;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Berkas Excel wajib" }, { status: 400 });
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const sheet = wb.getWorksheet("Karyawan") ?? wb.worksheets[0];
  if (!sheet) return NextResponse.json({ error: "Sheet Karyawan tidak ada" }, { status: 400 });

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, col) => {
    headers[col] = cellStr(cell.value).toLowerCase();
  });
  const missing = EMPLOYEE_IMPORT_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    return NextResponse.json({ error: `Kolom wajib hilang: ${missing.join(", ")}` }, { status: 400 });
  }
  const col = (name: string) => headers.indexOf(name);

  const sql = getDb();
  const [positions, ranks, groups, locations, employees] = await Promise.all([
    sql`SELECT id, code, name FROM positions WHERE deleted_at IS NULL`,
    sql`SELECT id, code, name FROM ranks WHERE deleted_at IS NULL`,
    sql`SELECT id, code, name FROM pay_groups`,
    sql`SELECT id, code, name FROM locations WHERE deleted_at IS NULL`,
    sql`SELECT id, employee_number, full_name FROM employees WHERE deleted_at IS NULL`,
  ]);
  const findPos = indexCatalog(positions as Catalog[]);
  const findRank = indexCatalog(ranks as Catalog[]);
  const findGroup = indexCatalog(groups as Catalog[]);
  const findLoc = indexCatalog(locations as Catalog[]);
  const empByNumber = new Map(
    (employees as { id: string; employee_number: string | null; full_name: string }[])
      .filter((e) => e.employee_number)
      .map((e) => [e.employee_number!.toLowerCase(), e]),
  );

  const errors: { row: number; message: string }[] = [];
  let created = 0;
  let skipped = 0;

  for (let i = 2; i <= sheet.rowCount; i += 1) {
    const row = sheet.getRow(i);
    const fullName = cellStr(row.getCell(col("nama")).value);
    if (!fullName || fullName.toLowerCase().startsWith("contoh ")) {
      skipped += 1;
      continue;
    }
    let employeeNumber = cellStr(row.getCell(col("nomor")).value) || null;
    if (employeeNumber && !RE.employeeNumber.test(employeeNumber)) {
      errors.push({ row: i, message: `Nomor ${employeeNumber} harus CW + 3 digit` });
      continue;
    }
    if (employeeNumber && empByNumber.has(employeeNumber.toLowerCase())) {
      errors.push({ row: i, message: `Nomor ${employeeNumber} sudah ada` });
      continue;
    }
    if (!employeeNumber) {
      employeeNumber = await allocateEmployeeNumber(sql, null);
    }
    const gender = parseGender(cellStr(row.getCell(col("jenis_kelamin")).value));
    const birthDate = cellStr(row.getCell(col("tanggal_lahir")).value) || null;
    const address = cellStr(row.getCell(col("alamat")).value) || null;
    const joinDate = cellStr(row.getCell(col("tanggal_bergabung")).value) || null;
    if (fullName.length < 2 || !RE.personName.test(fullName)) {
      errors.push({ row: i, message: "Nama tidak valid" });
      continue;
    }
    if (birthDate && !RE.isoDate.test(birthDate)) {
      errors.push({ row: i, message: "tanggal_lahir harus YYYY-MM-DD" });
      continue;
    }
    if (joinDate && !RE.isoDate.test(joinDate)) {
      errors.push({ row: i, message: "tanggal_bergabung harus YYYY-MM-DD" });
      continue;
    }
    const pos = findPos(cellStr(row.getCell(col("kode_jabatan")).value));
    const rank = findRank(cellStr(row.getCell(col("kode_pangkat")).value));
    const group = findGroup(cellStr(row.getCell(col("kode_kelompok_gaji")).value));
    const loc = findLoc(cellStr(row.getCell(col("kode_lokasi")).value));
    const supervisorKey = cellStr(row.getCell(col("nomor_atasan")).value);
    const supervisor = supervisorKey ? empByNumber.get(supervisorKey.toLowerCase()) : null;
    if (supervisorKey && !supervisor) {
      errors.push({ row: i, message: `Atasan ${supervisorKey} tidak ditemukan` });
      continue;
    }
    const jabatanRaw = cellStr(row.getCell(col("kode_jabatan")).value);
    if (jabatanRaw && !pos) {
      errors.push({ row: i, message: `Jabatan ${jabatanRaw} tidak ada di referensi` });
      continue;
    }
    const pangkatRaw = cellStr(row.getCell(col("kode_pangkat")).value);
    if (pangkatRaw && !rank) {
      errors.push({ row: i, message: `Pangkat ${pangkatRaw} tidak ada di referensi` });
      continue;
    }
    const groupRaw = cellStr(row.getCell(col("kode_kelompok_gaji")).value);
    if (groupRaw && !group) {
      errors.push({ row: i, message: `Kelompok gaji ${groupRaw} tidak ada di referensi` });
      continue;
    }
    let status = cellStr(row.getCell(col("status")).value).toLowerCase() || "draft";
    if (status !== "active") status = "draft";
    if (status === "active" && !(joinDate && pos && group)) {
      errors.push({
        row: i,
        message: "Status active ditolak: wajib jabatan, kelompok gaji, dan tanggal bergabung. Baris disimpan draf.",
      });
      status = "draft";
    }
    const inserted = await sql`
      INSERT INTO employees (
        full_name, employee_number, gender, birth_date, address, join_date,
        location_id, position_id, rank_id, pay_group_id, supervisor_employee_id,
        record_status, in_payroll, validation_required, has_login
      ) VALUES (
        ${fullName},
        ${employeeNumber},
        ${gender},
        ${birthDate}::date,
        ${address},
        ${joinDate}::date,
        ${loc?.id ?? null}::bigint,
        ${pos?.id ?? null}::bigint,
        ${rank?.id ?? null}::bigint,
        ${group?.id ?? null}::bigint,
        ${supervisor?.id ?? null}::bigint,
        ${status},
        FALSE,
        TRUE,
        FALSE
      )
      RETURNING id, employee_number
    `;
    const rec = inserted[0] as { id: string; employee_number: string | null };
    if (rec.employee_number) empByNumber.set(rec.employee_number.toLowerCase(), { id: rec.id, employee_number: rec.employee_number, full_name: fullName });
    created += 1;
    await logAudit({
      userId: g.session!.user.id,
      action: "create",
      entityType: "employee",
      entityId: rec.id,
      valueAfter: { source: "xlsx", fullName },
    });
  }

  return NextResponse.json({ created, skipped, errors });
}
