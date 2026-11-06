import { fmtDate, looksLikeDate } from "@/lib/utils/format";

export type ExportColumn<T> = {
  key: string;
  label: string;
  exportValue?: (row: T) => string | number | null | undefined;
};

export function cellExportValue<T>(column: ExportColumn<T>, row: T): string | number {
  if (column.exportValue) {
    const v = column.exportValue(row);
    if (v == null || v === "") return "";
    return v;
  }
  const raw = (row as Record<string, unknown>)[column.key];
  if (raw == null) return "";
  if (typeof raw === "number" || typeof raw === "bigint") return Number(raw);
  if (typeof raw === "boolean") return raw ? "Ya" : "Tidak";
  if (looksLikeDate(raw)) return fmtDate(raw);
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

export async function downloadXlsx<T>(opts: {
  filename: string;
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet((opts.sheetName || "Data").replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Data");
  ws.columns = [{ header: "No", width: 8 }, ...opts.columns.map((c) => ({ header: c.label, width: 22 }))];
  opts.rows.forEach((row, i) => {
    ws.addRow([i + 1, ...opts.columns.map((c) => cellExportValue(c, row))]);
  });
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF01665A" } };
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename.endsWith(".xlsx") ? opts.filename : `${opts.filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
