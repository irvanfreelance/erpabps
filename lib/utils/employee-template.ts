import ExcelJS from "exceljs";

export type CatalogRow = { code: string; name: string };

export const EMPLOYEE_IMPORT_HEADERS = [
  "nama",
  "nomor",
  "jenis_kelamin",
  "tanggal_lahir",
  "alamat",
  "tanggal_bergabung",
  "kode_jabatan",
  "kode_pangkat",
  "kode_kelompok_gaji",
  "kode_lokasi",
  "nomor_atasan",
  "status",
] as const;

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF01665A" },
};

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

function addRefSheet(wb: ExcelJS.Workbook, title: string, rows: CatalogRow[]) {
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = [
    { header: "kode", width: 22 },
    { header: "nama", width: 36 },
  ];
  styleHeader(ws);
  for (const r of rows) ws.addRow([r.code, r.name]);
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.font = { name: "Arial", size: 10 };
  });
}

export async function buildEmployeeTemplateWorkbook(refs: {
  positions: CatalogRow[];
  ranks: CatalogRow[];
  payGroups: CatalogRow[];
  locations: CatalogRow[];
  supervisors: CatalogRow[];
}) {
  const wb = new ExcelJS.Workbook();
  const isi = wb.addWorksheet("Karyawan");
  isi.columns = EMPLOYEE_IMPORT_HEADERS.map((h) => ({ header: h, width: 22 }));
  styleHeader(isi);
  const samplePos = refs.positions[0]?.code ?? "";
  const sampleRank = refs.ranks[0]?.code ?? "";
  const sampleGroup = refs.payGroups[0]?.code ?? "";
  const sampleLoc = refs.locations[0]?.code ?? "";
  isi.addRow([
    "Contoh Nama",
    "ABPS-CONTOH",
    "Laki-laki",
    "1998-01-15",
    "Jl. Contoh No. 1",
    "2026-01-02",
    samplePos,
    sampleRank,
    sampleGroup,
    sampleLoc,
    "",
    "draft",
  ]);
  isi.getRow(2).font = { name: "Arial", size: 10, italic: true, color: { argb: "FF888888" } };

  const ket = wb.addWorksheet("Cara isi");
  ket.columns = [{ header: "petunjuk", width: 90 }];
  styleHeader(ket);
  const lines = [
    "Isi sheet Karyawan. Baris kedua adalah contoh — hapus sebelum unggah, atau biarkan (nomor ABPS-CONTOH akan ditolak bila sudah ada).",
    "Kolom kode_jabatan dan kode_pangkat wajib memakai kode dari sheet Referensi jabatan dan Referensi pangkat. Jangan mengetik nama bebas.",
    "jenis_kelamin: Laki-laki / Perempuan / L / P.",
    "tanggal memakai YYYY-MM-DD.",
    "status: draft atau active. Active hanya jika nomor, kode_jabatan, kode_kelompok_gaji, dan tanggal_bergabung terisi. Tanggal kosong tetap kosong (tidak diisi hari ini).",
    "nomor_atasan: nomor karyawan atasan langsung (satu orang), atau kosong.",
    "Jangan mengisi NIK, HP, atau rekening di berkas ini.",
    "Sheet referensi berisi data lembaga yang sedang dipakai — salin kodenya, jangan mengubah sheet itu.",
  ];
  for (const line of lines) ket.addRow([line]).font = { name: "Arial", size: 10 };

  addRefSheet(wb, "Referensi jabatan", refs.positions);
  addRefSheet(wb, "Referensi pangkat", refs.ranks);
  addRefSheet(wb, "Referensi kelompok gaji", refs.payGroups);
  addRefSheet(wb, "Referensi lokasi", refs.locations);
  addRefSheet(wb, "Referensi atasan", refs.supervisors);

  return wb.xlsx.writeBuffer();
}

export function parseGender(raw: string | null | undefined) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (["l", "laki-laki", "laki", "male", "pria"].includes(v)) return "male";
  if (["p", "perempuan", "female", "wanita"].includes(v)) return "female";
  return null;
}

export function cellStr(v: unknown) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "text" in (v as { text?: string })) return String((v as { text: string }).text ?? "");
  if (typeof v === "number" && Number.isFinite(v) && v > 20000 && v < 60000) {
    const epoch = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!Number.isNaN(epoch.getTime())) return epoch.toISOString().slice(0, 10);
  }
  return String(v).trim();
}
