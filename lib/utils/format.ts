export function parseMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return Math.round(raw);
  }
  const digits = String(raw).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function formatMoneyDigits(digits: string) {
  const n = parseMoney(digits);
  if (n == null) return "";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

export function fmtRp(n: number | string | bigint | null | undefined) {
  if (n == null || n === "") return "—";
  const num = typeof n === "bigint" ? Number(n) : Number(String(n).replace(",", "."));
  if (!Number.isFinite(num)) return "—";
  return `Rp ${Math.round(num).toLocaleString("id-ID", { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

export function looksLikeDate(value: unknown): value is string | Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value !== "string") return false;
  return ISO_DATE.test(value.trim());
}

const WIB_DATE = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const WIB_DATE_TIME = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function parseDate(value: string | Date) {
  if (value instanceof Date) {
    const dateOnly =
      value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0;
    return { d: value, dateOnly };
  }
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { d: new Date(`${raw}T00:00:00.000Z`), dateOnly: true };
  }
  const d = new Date(raw);
  const dateOnly = /T00:00:00(\.0+)?(Z|[+-]00:00)?$/.test(raw);
  return { d, dateOnly };
}

export function fmtDate(value: string | Date | null | undefined) {
  if (value == null || value === "") return "—";
  const { d, dateOnly } = parseDate(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  const parts = WIB_DATE_TIME.formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  if (dateOnly || (hour === "00" && minute === "00")) return WIB_DATE.format(d);
  return `${WIB_DATE_TIME.format(d)} WIB`;
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

/** Perkiraan kalender: 365 hari = 1 tahun, 30 hari = 1 bulan. */
export function fmtTenure(days: number | null | undefined) {
  if (days == null || !Number.isFinite(Number(days))) return "—";
  const total = Math.max(0, Math.floor(Number(days)));
  const y = Math.floor(total / 365);
  const rem = total % 365;
  const m = Math.floor(rem / 30);
  const d = rem % 30;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} th`);
  if (m > 0) parts.push(`${m} bl`);
  if (d > 0 || parts.length === 0) parts.push(`${d} hr`);
  return parts.join(" ");
}
