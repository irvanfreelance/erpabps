import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { ownEmployeeId } from "@/lib/hrd/scope";
import { resolveSetting } from "@/lib/hrd/settings";
import { getWibParts } from "@/lib/utils/date-wib";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("attendances.clock", "create");
  if (g.error) return g.error;
  const sql = getDb();
  const empId = await ownEmployeeId(sql, g.session!.user);
  if (!empId) {
    return NextResponse.json({ error: "Akun ini tidak terhubung ke karyawan" }, { status: 400 });
  }

  const { dateStr: today, timeStr: nowWib } = getWibParts();

  const empRows = await sql`
    SELECT e.id, e.full_name, e.employee_number, e.employee_type, e.can_clock_outside_radius,
           e.position_id, e.location_id, e.pay_group_id,
           l.name AS location_name, l.latitude AS location_lat, l.longitude AS location_lng,
           COALESCE(l.radius_meter, 100) AS radius_meter
    FROM employees e
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE e.id = ${empId}::bigint
  `;
  const emp = empRows[0] as {
    id: string;
    full_name: string;
    employee_number: string | null;
    employee_type: string | null;
    can_clock_outside_radius: boolean;
    position_id: string | null;
    location_id: string | null;
    pay_group_id: string | null;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    radius_meter: number;
  };

  const attRows = await sql`
    SELECT id, attendance_date, clock_in_at, clock_out_at, clock_in_lat, clock_in_lng,
           clock_out_lat, clock_out_lng, status, late_minutes, payable_minutes,
           clock_in_status, outside_radius_note, late_reason
    FROM attendances
    WHERE employee_id = ${empId}::bigint AND attendance_date = ${today}::date
    LIMIT 1
  `;
  const attendance = attRows[0] || null;

  const asgRows = await sql`
    SELECT sa.id, st.code AS shift_code, st.name AS shift_name, st.shift_kind,
           COALESCE(sa.start_time, st.start_time) AS start_time,
           COALESCE(sa.end_time, st.end_time) AS end_time,
           sa.day_status
    FROM shift_assignments sa
    JOIN shift_templates st ON st.id = sa.shift_template_id
    WHERE sa.employee_id = ${empId}::bigint AND sa.work_date = ${today}::date
    LIMIT 1
  `;
  let assignment = (asgRows[0] || null) as {
    id: string;
    shift_code: string;
    shift_name: string;
    shift_kind: string;
    start_time: string | null;
    end_time: string | null;
    day_status?: string;
  } | null;

  // Jika office dan belum ada assignment jadwal harian, ambil setting dinamis office
  if (!assignment && emp.employee_type === "office") {
    const officeStart = await resolveSetting(sql, "office.work_start_time", today, {
      employeeId: emp.id,
      positionId: emp.position_id,
      locationId: emp.location_id,
    });
    const officeEnd = await resolveSetting(sql, "office.work_end_time", today, {
      employeeId: emp.id,
      positionId: emp.position_id,
      locationId: emp.location_id,
    });
    assignment = {
      id: "office-default",
      shift_code: "OFFICE",
      shift_name: "Reguler Office",
      shift_kind: "regular",
      start_time: String(officeStart.value || "08:00"),
      end_time: String(officeEnd.value || "17:00"),
      day_status: "work",
    };
  }

  return NextResponse.json(
    jsonSafe({
      employee: emp,
      attendance,
      assignment,
      today,
      nowWib,
    }),
  );
}
