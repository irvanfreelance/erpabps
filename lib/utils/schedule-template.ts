import ExcelJS from "exceljs";
import { monthDays, weekdayLabel } from "@/lib/hrd/schedule";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF01665A" },
};

type Catalog = { code: string; name: string };

export function cellStr(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object" && value && "text" in (value as { text?: string })) {
    return String((value as { text?: string }).text ?? "").trim();
  }
  if (typeof value === "object" && value && "result" in (value as { result?: unknown })) {
    return cellStr((value as { result?: unknown }).result);
  }
  return String(value).trim();
}

export async function buildScheduleTemplateWorkbook(input: {
  month: string;
  crew: Catalog[];
  templates: Catalog[];
}) {
  const wb = new ExcelJS.Workbook();
  const days = monthDays(input.month);
  const jadwal = wb.addWorksheet("Jadwal");
  const headers = ["nama", ...days.map((d) => d.date)];
  jadwal.addRow(headers);
  const head = jadwal.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
  head.fill = HEADER_FILL;
  jadwal.getColumn(1).width = 28;
  days.forEach((_, i) => {
    jadwal.getColumn(i + 2).width = 12;
  });
  for (const c of input.crew) {
    const row = jadwal.addRow([c.name, ...days.map(() => "")]);
    row.font = { name: "Arial", size: 10 };
  }

  const ref = wb.addWorksheet("Referensi");
  ref.columns = [
    { header: "jenis", width: 16 },
    { header: "kode", width: 16 },
    { header: "nama", width: 36 },
  ];
  ref.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
  ref.getRow(1).fill = HEADER_FILL;
  for (const t of input.templates) ref.addRow(["shift", t.code, t.name]);
  for (const s of [
    ["status", "work", "Masuk"],
    ["status", "OFF", "Libur"],
    ["status", "OFF_IZIN", "Izin"],
    ["status", "OFF_SAKIT", "Sakit"],
    ["jam", "08:00-18:00", "Jam khusus"],
  ]) {
    ref.addRow(s);
  }
  for (const c of input.crew) ref.addRow(["crew", c.code, c.name]);
  ref.eachRow((row, i) => {
    if (i === 1) return;
    row.font = { name: "Arial", size: 10 };
  });

  const ket = wb.addWorksheet("Cara isi");
  ket.columns = [{ header: "petunjuk", width: 90 }];
  ket.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
  ket.getRow(1).fill = HEADER_FILL;
  for (const line of [
    `Isi sheet Jadwal untuk bulan ${input.month}. Kolom adalah setiap tanggal.`,
    "Kode: P1, P2, MID, S3, BACKUP, OFF, OFF_IZIN, OFF_SAKIT, atau jam 08:00-18:00.",
    "Nama harus sama dengan nama crew outlet di sheet Referensi.",
    "Tim office tidak diimpor. Station dan hitung SO tidak dipakai.",
    `Contoh header hari: ${days.slice(0, 3).map((d) => `${weekdayLabel(d.dow)} ${d.day}`).join(", ")}`,
  ]) {
    ket.addRow([line]).font = { name: "Arial", size: 10 };
  }
  return wb.xlsx.writeBuffer();
}
