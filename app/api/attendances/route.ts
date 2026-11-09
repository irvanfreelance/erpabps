import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { ownEmployeeId, visibleEmployeeIds } from "@/lib/hrd/scope";
import { resolveSetting } from "@/lib/hrd/settings";
import { calculateLateMinutes, getWibParts, parseTimeToSeconds } from "@/lib/utils/date-wib";
import { calculateDistanceMeter } from "@/lib/utils/geo";
import { jsonSafe } from "@/lib/utils/serialize";

const clockSchema = z.object({
  kind: z.enum(["in", "out"]),
  lat: z.number().optional(),
  lng: z.number().optional(),
  outsideRadiusNote: z.string().optional(),
  lateReason: z.string().optional(),
});

const backdateSchema = z.object({
  employeeId: z.string(),
  attendanceDate: z.string(),
  clockInAt: z.string(),
  clockOutAt: z.string().nullable().optional(),
  reason: z.string().min(3),
});

export async function GET(req: Request) {
  const g = await guard("attendances", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeType = searchParams.get("employeeType");
  const locationId = searchParams.get("locationId");
  const clockInStatus = searchParams.get("clockInStatus");
  const isLate = searchParams.get("isLate");
  const q = searchParams.get("q")?.trim();

  const rows = await sql`
    SELECT a.id, a.employee_id, e.full_name, e.employee_number, e.employee_type,
           to_char(a.attendance_date, 'YYYY-MM-DD') AS attendance_date,
           to_char(a.clock_in_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS clock_in_time,
           to_char(a.clock_out_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS clock_out_time,
           a.clock_in_at, a.clock_out_at,
           a.status, a.late_minutes, a.payable_minutes, a.clock_in_status,
           a.outside_radius_note, a.late_reason, a.backdate_reason,
           l.name AS location_name,
           st.code AS shift_code, st.name AS shift_name
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    LEFT JOIN locations l ON l.id = a.location_id
    LEFT JOIN shift_assignments sa ON sa.id = a.shift_assignment_id
    LEFT JOIN shift_templates st ON st.id = sa.shift_template_id
    WHERE (${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[]))
      AND (${from}::date IS NULL OR a.attendance_date >= ${from}::date)
      AND (${to}::date IS NULL OR a.attendance_date <= ${to}::date)
      AND (${employeeType}::varchar IS NULL OR e.employee_type = ${employeeType})
      AND (${locationId}::bigint IS NULL OR a.location_id = ${locationId}::bigint)
      AND (${clockInStatus}::varchar IS NULL OR a.clock_in_status = ${clockInStatus})
      AND (
        ${isLate}::varchar IS NULL
        OR (${isLate} = 'yes' AND a.late_minutes > 0)
        OR (${isLate} = 'no' AND a.late_minutes = 0)
      )
      AND (
        ${q}::varchar IS NULL
        OR e.full_name ILIKE ${"%" + (q || "") + "%"}
        OR e.employee_number ILIKE ${"%" + (q || "") + "%"}
        OR a.outside_radius_note ILIKE ${"%" + (q || "") + "%"}
        OR a.late_reason ILIKE ${"%" + (q || "") + "%"}
      )
    ORDER BY a.attendance_date DESC, a.clock_in_at DESC NULLS LAST, e.full_name
    LIMIT 2000
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body?.backdate) {
    const g = await guard("attendances.backdate", "approve");
    if (g.error) return g.error;
    const parsed = backdateSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);
    const sql = getDb();
    const actor = await actorUserId(sql, g.session!.user);
    if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
    const rows = await sql`
      INSERT INTO attendances (
        employee_id, attendance_date, clock_in_at, clock_out_at,
        status, clock_in_status, backdate_reason, recorded_by, late_minutes
      ) VALUES (
        ${parsed.data.employeeId}::bigint, ${parsed.data.attendanceDate}::date,
        ${parsed.data.clockInAt}::timestamptz, ${parsed.data.clockOutAt ?? null}::timestamptz,
        'present', 'hr_backdate', ${parsed.data.reason}, ${actor}::bigint, 0
      )
      ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
        clock_in_at = EXCLUDED.clock_in_at,
        clock_out_at = EXCLUDED.clock_out_at,
        clock_in_status = 'hr_backdate',
        backdate_reason = EXCLUDED.backdate_reason,
        recorded_by = EXCLUDED.recorded_by,
        updated_at = now()
      RETURNING id
    `;
    await logAudit({
      userId: g.session!.user.id,
      action: "backdate",
      entityType: "attendance",
      entityId: String((rows[0] as { id: string }).id),
      valueAfter: { reason: parsed.data.reason },
    });
    return NextResponse.json(jsonSafe(rows[0]));
  }

  const g = await guard("attendances.clock", "create");
  if (g.error) return g.error;
  const parsed = clockSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const empId = await ownEmployeeId(sql, g.session!.user);
  if (!empId) return NextResponse.json({ error: "Akun ini tidak terhubung ke karyawan" }, { status: 400 });

  const empRows = await sql`
    SELECT e.id, e.position_id, e.location_id, e.pay_group_id, e.employee_type, e.can_clock_outside_radius,
           l.latitude, l.longitude, COALESCE(l.radius_meter, 100) AS radius_meter
    FROM employees e
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE e.id = ${empId}::bigint
  `;
  const emp = empRows[0] as {
    id: string;
    position_id: string | null;
    location_id: string | null;
    pay_group_id: string | null;
    employee_type: string | null;
    can_clock_outside_radius: boolean;
    latitude: number | null;
    longitude: number | null;
    radius_meter: number;
  };

  const wib = getWibParts();
  const today = wib.dateStr;

  // Validasi Radius
  let isOutside = false;
  if (parsed.data.lat != null && parsed.data.lng != null && emp.latitude != null && emp.longitude != null) {
    const dist = calculateDistanceMeter(parsed.data.lat, parsed.data.lng, Number(emp.latitude), Number(emp.longitude));
    if (dist > emp.radius_meter) {
      isOutside = true;
      if (!emp.can_clock_outside_radius) {
        return NextResponse.json(
          { error: `Anda berada di luar radius lokasi presensi (${dist}m, maks ${emp.radius_meter}m).` },
          { status: 400 },
        );
      }
      if (!parsed.data.outsideRadiusNote?.trim()) {
        return NextResponse.json(
          { error: "Presensi di luar radius wajib menyertakan alasan keterangan." },
          { status: 400 },
        );
      }
    }
  }

  const lateMode = await resolveSetting(sql, "attendance.late_deduction_mode", today, {
    employeeId: emp.id,
    positionId: emp.position_id,
    locationId: emp.location_id,
    payGroupId: emp.pay_group_id,
  });

  const assignment = await sql`
    SELECT sa.id, st.shift_kind, COALESCE(sa.start_time, st.start_time) AS start_time
    FROM shift_assignments sa
    JOIN shift_templates st ON st.id = sa.shift_template_id
    WHERE sa.employee_id = ${empId}::bigint AND sa.work_date = ${today}::date
    LIMIT 1
  `;
  const asg = assignment[0] as { id: string; shift_kind: string; start_time: string | null } | undefined;
  const backup = asg?.shift_kind === "backup";
  const now = new Date();
  const nowIso = now.toISOString();

  // Hitung keterlambatan zona waktu Asia/Jakarta (WIB):
  // Untuk crew dapur (employee_type = 'dapur'): lateMinutes selalu 0
  // Untuk shift backup: lateMinutes selalu 0
  // Untuk non-dapur (outlet & office): dihitung per menit sejak menit ke-1 setelah jam mulai kerja
  // Contoh: tepat 08:00:00 tidak telat, lewat 08:00:01 s.d 08:01:00 telat 1 menit
  let lateMinutes = 0;
  if (emp.employee_type !== "dapur" && !backup && lateMode.value !== "none") {
    let expectedStart = asg?.start_time;
    if (!expectedStart && emp.employee_type === "office") {
      const officeStartSetting = await resolveSetting(sql, "office.work_start_time", today, {
        employeeId: emp.id,
        positionId: emp.position_id,
        locationId: emp.location_id,
      });
      expectedStart = String(officeStartSetting.value || "08:00:00");
    }
    if (expectedStart) {
      const targetSeconds = parseTimeToSeconds(expectedStart);
      lateMinutes = calculateLateMinutes(wib.totalSeconds, targetSeconds);
    }
  }

  if (parsed.data.kind === "in" && lateMinutes > 0 && !parsed.data.lateReason?.trim()) {
    return NextResponse.json(
      { error: "Anda terlambat. Wajib mengisi keterangan alasan keterlambatan.", isLate: true, lateMinutes },
      { status: 400 },
    );
  }

  const clockInStatus = isOutside ? "outside_radius" : "valid";

  if (parsed.data.kind === "in") {
    const rows = await sql`
      INSERT INTO attendances (
        employee_id, location_id, shift_assignment_id, attendance_date, clock_in_at,
        clock_in_lat, clock_in_lng, status, late_minutes, clock_in_status, outside_radius_note, late_reason, recorded_by
      ) VALUES (
        ${empId}::bigint, ${emp.location_id}::bigint, ${asg?.id ?? null}::bigint, ${today}::date, ${nowIso}::timestamptz,
        ${parsed.data.lat ?? null}, ${parsed.data.lng ?? null}, 'present',
        ${lateMinutes}, ${clockInStatus}, ${parsed.data.outsideRadiusNote?.trim() || null}, ${parsed.data.lateReason?.trim() || null}, ${g.session!.user.id}::bigint
      )
      ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
        clock_in_at = COALESCE(attendances.clock_in_at, EXCLUDED.clock_in_at),
        late_minutes = EXCLUDED.late_minutes,
        clock_in_status = EXCLUDED.clock_in_status,
        outside_radius_note = EXCLUDED.outside_radius_note,
        late_reason = EXCLUDED.late_reason,
        updated_at = now()
      RETURNING *
    `;
    await logAudit({ userId: g.session!.user.id, action: "clock_in", entityType: "attendance", entityId: String((rows[0] as { id: string }).id) });
    return NextResponse.json(jsonSafe(rows[0]));
  }

  const rows = await sql`
    UPDATE attendances SET
      clock_out_at = ${nowIso}::timestamptz,
      clock_out_lat = ${parsed.data.lat ?? null},
      clock_out_lng = ${parsed.data.lng ?? null},
      updated_at = now()
    WHERE employee_id = ${empId}::bigint AND attendance_date = ${today}::date
    RETURNING *
  `;
  if (!rows[0]) return NextResponse.json({ error: "Belum clock-in hari ini" }, { status: 400 });
  await logAudit({ userId: g.session!.user.id, action: "clock_out", entityType: "attendance", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
