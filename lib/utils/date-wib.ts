/**
 * Utilitas format waktu dan tanggal presisi zona waktu Asia/Jakarta (WIB, UTC+7).
 */

const TIMEZONE = "Asia/Jakarta";

export function getWibParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  const year = map.year;
  const month = map.month;
  const day = map.day;
  const hour = map.hour === "24" ? "00" : map.hour;
  const minute = map.minute;
  const second = map.second;

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}:${second}`;
  const totalSeconds = Number(hour) * 3600 + Number(minute) * 60 + Number(second);

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    dateStr,
    timeStr,
    totalSeconds,
  };
}

export function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const s = Number(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}

/**
 * Hitung selisih telat dalam menit:
 * Tepat jam mulai (cth 08:00:00) tidak telat.
 * 08:00:01 s.d 08:01:00 terhitung telat 1 menit.
 */
export function calculateLateMinutes(actualSeconds: number, targetSeconds: number): number {
  if (actualSeconds <= targetSeconds) {
    return 0;
  }
  const diffSec = actualSeconds - targetSeconds;
  return Math.ceil(diffSec / 60);
}
