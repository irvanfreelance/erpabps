export function fmtRp(n: number | string | bigint | null | undefined) {
  if (n == null || n === "") return "—";
  return "Rp " + Number(n).toLocaleString("id-ID");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

export function looksLikeDate(value: unknown): value is string | Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value !== "string") return false;
  return ISO_DATE.test(value.trim());
}

const WIB = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function fmtDate(value: string | Date | null | undefined) {
  if (value == null || value === "") return "—";
  const raw = typeof value === "string" ? value.trim() : value;
  const d =
    typeof raw === "string"
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw)
      : raw;
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  return `${WIB.format(d)} WIB`;
}

export function formatCell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (looksLikeDate(value)) return fmtDate(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function toNum(v: unknown) {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  return Number(v);
}
