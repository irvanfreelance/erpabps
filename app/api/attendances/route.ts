import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { ownEmployeeId, visibleEmployeeIds } from "@/lib/hrd/scope";
import { resolveSetting } from "@/lib/hrd/settings";
import { jsonSafe } from "@/lib/utils/serialize";

const clockSchema = z.object({
  kind: z.enum(["in", "out"]),
  lat: z.number().optional(),
  lng: z.number().optional(),
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
  const rows = await sql`
    SELECT a.id, a.employee_id, e.full_name, a.attendance_date, a.clock_in_at, a.clock_out_at,
           a.status, a.late_minutes, a.payable_minutes, a.clock_in_status, a.backdate_reason
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    WHERE (${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[]))
      AND (${from}::date IS NULL OR a.attendance_date >= ${from}::date)
      AND (${to}::date IS NULL OR a.attendance_date <= ${to}::date)
    ORDER BY a.attendance_date DESC, e.full_name
    LIMIT 500
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

  const emp = (await sql`
    SELECT id, position_id, location_id, pay_group_id FROM employees WHERE id = ${empId}::bigint
  `)[0] as { id: string; position_id: string | null; location_id: string | null; pay_group_id: string | null };

  const today = new Date().toISOString().slice(0, 10);
  const lateMode = await resolveSetting(sql, "attendance.late_deduction_mode", today, {
    employeeId: emp.id,
    positionId: emp.position_id,
    locationId: emp.location_id,
    payGroupId: emp.pay_group_id,
  });

  const assignment = await sql`
    SELECT sa.id, st.shift_kind, st.start_time
    FROM shift_assignments sa
    JOIN shift_templates st ON st.id = sa.shift_template_id
    WHERE sa.employee_id = ${empId}::bigint AND sa.work_date = ${today}::date
    LIMIT 1
  `;
  const asg = assignment[0] as { id: string; shift_kind: string; start_time: string } | undefined;
  const backup = asg?.shift_kind === "backup";
  const nowIso = new Date().toISOString();

  if (parsed.data.kind === "in") {
    const rows = await sql`
      INSERT INTO attendances (
        employee_id, location_id, shift_assignment_id, attendance_date, clock_in_at,
        clock_in_lat, clock_in_lng, status, late_minutes, recorded_by
      ) VALUES (
        ${empId}::bigint, ${emp.location_id}::bigint, ${asg?.id ?? null}::bigint, ${today}::date, ${nowIso}::timestamptz,
        ${parsed.data.lat ?? null}, ${parsed.data.lng ?? null}, 'present',
        ${backup || lateMode.value === "none" ? 0 : 0}, ${g.session!.user.id}::bigint
      )
      ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
        clock_in_at = COALESCE(attendances.clock_in_at, EXCLUDED.clock_in_at),
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
