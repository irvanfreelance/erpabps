export const OUTLET_PAY_GROUP = "MONTHLY_OUTLET";

export const DAY_STATUSES = ["work", "off", "off_izin", "off_sakit"] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

export function monthDays(month: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return [];
  const year = Number(m[1]);
  const mo = Number(m[2]);
  const last = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  const days: { date: string; day: number; dow: number }[] = [];
  for (let d = 1; d <= last; d += 1) {
    const date = `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date, day: d, dow: new Date(Date.UTC(year, mo - 1, d)).getUTCDay() });
  }
  return days;
}

export function shiftTimeRange(raw: string) {
  const m = /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/.exec(raw.trim());
  if (!m) return null;
  const pad = (h: string, min: string) => `${h.padStart(2, "0")}:${min}`;
  return { start: pad(m[1], m[2]), end: pad(m[3], m[4]) };
}

export function parseScheduleToken(raw: string): {
  code?: string;
  dayStatus: DayStatus;
  startTime?: string;
  endTime?: string;
  notes?: string;
} | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return null;
  const times = shiftTimeRange(v);
  if (times) return { code: "CUSTOM", dayStatus: "work", startTime: times.start, endTime: times.end };
  if (v === "p1" || v === "shift 1" || v === "shift1") return { code: "P1", dayStatus: "work" };
  if (v === "p2" || v === "shift 2" || v === "shift2") return { code: "P2", dayStatus: "work" };
  if (v === "mid" || v === "middle") return { code: "MID", dayStatus: "work" };
  if (v === "s3" || v === "shift 3" || v === "shift3") return { code: "S3", dayStatus: "work" };
  if (v === "backup") return { code: "BACKUP", dayStatus: "work" };
  if (v === "custom") return { code: "CUSTOM", dayStatus: "work" };
  if (v === "off_izin" || v === "off izin" || v === "off ijin") {
    return { code: "OFF", dayStatus: "off_izin" };
  }
  if (v === "off_sakit" || v === "off sakit") return { code: "OFF", dayStatus: "off_sakit" };
  if (v === "off") return { code: "OFF", dayStatus: "off" };
  if (v.startsWith("off req") || v === "off request" || v === "off reg") {
    return { code: "OFF", dayStatus: "off", notes: "permintaan" };
  }
  return null;
}

export function weekdayLabel(dow: number) {
  return ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][dow] ?? "";
}
