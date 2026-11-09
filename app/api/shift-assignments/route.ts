import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { OUTLET_PAY_GROUP } from "@/lib/hrd/schedule";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";
import { checkPermission } from "@/lib/auth/rbac";

const assignSchema = z.object({
  action: z.literal("assign").optional(),
  employeeId: z.string(),
  workDate: z.string(),
  shiftTemplateId: z.string().optional(),
  shiftCode: z.string().optional(),
  dayStatus: z.string().default("work"),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const moveSchema = z.object({
  action: z.literal("move"),
  fromEmployeeId: z.string(),
  fromDate: z.string(),
  toEmployeeId: z.string(),
  toDate: z.string(),
});

type Sql = ReturnType<typeof getDb>;

async function assertOutletCrew(sql: Sql, employeeId: string, ids: string[] | null) {
  if (ids && !ids.includes(employeeId)) return "Forbidden";
  const rows = await sql`
    SELECT e.id
    FROM employees e
    JOIN pay_groups g ON g.id = e.pay_group_id AND g.code = ${OUTLET_PAY_GROUP}
    WHERE e.id = ${employeeId}::bigint AND e.deleted_at IS NULL
  `;
  if (!rows[0]) return "Hanya crew outlet";
  return null;
}

async function resolveTemplate(
  sql: Sql,
  input: { shiftTemplateId?: string; shiftCode?: string; dayStatus: string; startTime?: string | null; endTime?: string | null },
) {
  let code = input.shiftCode;
  if (input.dayStatus === "off" || input.dayStatus === "off_izin" || input.dayStatus === "off_sakit") code = "OFF";
  else if (input.startTime && input.endTime) code = code ?? "CUSTOM";
  if (input.shiftTemplateId) {
    const rows = await sql`
      SELECT id, code, shift_kind FROM shift_templates
      WHERE id = ${input.shiftTemplateId}::bigint AND deleted_at IS NULL
    `;
    return rows[0] as { id: string; code: string; shift_kind: string } | undefined;
  }
  if (!code) return undefined;
  const rows = await sql`
    SELECT id, code, shift_kind FROM shift_templates
    WHERE code = ${code} AND deleted_at IS NULL
  `;
  return rows[0] as { id: string; code: string; shift_kind: string } | undefined;
}

async function upsertAssignment(
  sql: Sql,
  actor: string,
  d: {
    employeeId: string;
    workDate: string;
    templateId: string;
    dayStatus: string;
    isBackup: boolean;
    startTime: string | null;
    endTime: string | null;
    notes: string | null;
  },
) {
  const rows = await sql`
    INSERT INTO shift_assignments (
      employee_id, shift_template_id, work_date, day_status, is_backup,
      start_time, end_time, assigned_by, notes
    ) VALUES (
      ${d.employeeId}::bigint, ${d.templateId}::bigint, ${d.workDate}::date, ${d.dayStatus}, ${d.isBackup},
      ${d.startTime}::time, ${d.endTime}::time, ${actor}::bigint, ${d.notes}
    )
    ON CONFLICT (employee_id, work_date) DO UPDATE SET
      shift_template_id = EXCLUDED.shift_template_id,
      day_status = EXCLUDED.day_status,
      is_backup = EXCLUDED.is_backup,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      notes = EXCLUDED.notes,
      assigned_by = EXCLUDED.assigned_by,
      updated_at = now()
    RETURNING id
  `;
  return String((rows[0] as { id: string }).id);
}

export async function GET(req: Request) {
  const g = await guard("schedules", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const locationId = url.searchParams.get("locationId");

  // Seluruh pengguna (superadmin, superordinat, subordinat) bisa melihat seluruh jadwal crew outlet
  // Namun hanya superadmin dan superordinat yang memiliki izin canWrite: true
  const employees = await sql`
    SELECT e.id, e.full_name, e.location_id, l.name AS location_name
    FROM employees e
    JOIN pay_groups g ON g.id = e.pay_group_id AND g.code = ${OUTLET_PAY_GROUP}
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE e.deleted_at IS NULL
      AND (${locationId}::text IS NULL OR e.location_id = ${locationId}::bigint)
    ORDER BY e.full_name
  `;
  const empIds = (employees as { id: string }[]).map((e) => e.id);
  const rows = empIds.length
    ? await sql`
        SELECT sa.id, sa.employee_id, e.full_name, to_char(sa.work_date, 'YYYY-MM-DD') AS work_date,
               sa.station_code, sa.day_status, sa.is_backup, sa.notes,
               to_char(sa.start_time, 'HH24:MI') AS start_time,
               to_char(sa.end_time, 'HH24:MI') AS end_time,
               st.id AS shift_template_id, st.code AS shift_code, st.name AS shift_name,
               st.shift_kind, to_char(st.start_time, 'HH24:MI') AS template_start,
               to_char(st.end_time, 'HH24:MI') AS template_end
        FROM shift_assignments sa
        JOIN employees e ON e.id = sa.employee_id
        JOIN shift_templates st ON st.id = sa.shift_template_id
        WHERE sa.employee_id = ANY(${empIds}::bigint[])
          AND (${month}::text IS NULL OR to_char(sa.work_date, 'YYYY-MM') = ${month})
        ORDER BY sa.work_date, e.full_name
      `
    : [];
  const templates = await sql`
    SELECT id, code, name, shift_kind, to_char(start_time, 'HH24:MI') AS start_time,
           to_char(end_time, 'HH24:MI') AS end_time
    FROM shift_templates WHERE deleted_at IS NULL ORDER BY code
  `;
  return NextResponse.json(
    jsonSafe({
      employees,
      rows,
      templates,
      canWrite: checkPermission(g.session!.user.role, "schedules", "update"),
    }),
  );
}

export async function POST(req: Request) {
  const g = await guard("schedules", "create");
  if (g.error) return g.error;
  const body = await req.json();
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  const ids = await visibleEmployeeIds(sql, g.session!.user);

  if (body?.action === "move") {
    const parsed = moveSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);
    const d = parsed.data;
    for (const emp of [d.fromEmployeeId, d.toEmployeeId]) {
      const err = await assertOutletCrew(sql, emp, ids);
      if (err) return NextResponse.json({ error: err }, { status: 403 });
    }
    const fromRows = await sql`
      SELECT id, shift_template_id, day_status, is_backup, notes,
             to_char(start_time, 'HH24:MI') AS start_time,
             to_char(end_time, 'HH24:MI') AS end_time
      FROM shift_assignments
      WHERE employee_id = ${d.fromEmployeeId}::bigint AND work_date = ${d.fromDate}::date
    `;
    const from = fromRows[0] as
      | {
          id: string;
          shift_template_id: string;
          day_status: string;
          is_backup: boolean;
          start_time: string | null;
          end_time: string | null;
          notes: string | null;
        }
      | undefined;
    if (!from) return NextResponse.json({ error: "Sumber kosong" }, { status: 400 });
    const toRows = await sql`
      SELECT id, shift_template_id, day_status, is_backup, notes,
             to_char(start_time, 'HH24:MI') AS start_time,
             to_char(end_time, 'HH24:MI') AS end_time
      FROM shift_assignments
      WHERE employee_id = ${d.toEmployeeId}::bigint AND work_date = ${d.toDate}::date
    `;
    const to = toRows[0] as typeof from | undefined;
    await sql`
      DELETE FROM shift_assignments
      WHERE (employee_id = ${d.fromEmployeeId}::bigint AND work_date = ${d.fromDate}::date)
         OR (employee_id = ${d.toEmployeeId}::bigint AND work_date = ${d.toDate}::date)
    `;
    const newId = await upsertAssignment(sql, actor, {
      employeeId: d.toEmployeeId,
      workDate: d.toDate,
      templateId: String(from.shift_template_id),
      dayStatus: from.day_status,
      isBackup: from.is_backup,
      startTime: from.start_time,
      endTime: from.end_time,
      notes: from.notes,
    });
    if (to) {
      await upsertAssignment(sql, actor, {
        employeeId: d.fromEmployeeId,
        workDate: d.fromDate,
        templateId: String(to.shift_template_id),
        dayStatus: to.day_status,
        isBackup: to.is_backup,
        startTime: to.start_time,
        endTime: to.end_time,
        notes: to.notes,
      });
    }
    await logAudit({
      userId: g.session!.user.id,
      action: "update",
      entityType: "shift_assignment",
      entityId: newId,
    });
    return NextResponse.json(jsonSafe({ ok: true, id: newId }));
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const denied = await assertOutletCrew(sql, d.employeeId, ids);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const custom = Boolean(d.startTime && d.endTime);
  const tpl = await resolveTemplate(sql, {
    shiftTemplateId: d.shiftTemplateId,
    shiftCode: d.shiftCode,
    dayStatus: d.dayStatus,
    startTime: d.startTime,
    endTime: d.endTime,
  });
  if (!tpl) return NextResponse.json({ error: "Template shift tidak ada" }, { status: 400 });
  const id = await upsertAssignment(sql, actor, {
    employeeId: d.employeeId,
    workDate: d.workDate,
    templateId: String(tpl.id),
    dayStatus: d.dayStatus,
    isBackup: tpl.shift_kind === "backup",
    startTime: custom ? d.startTime! : null,
    endTime: custom ? d.endTime! : null,
    notes: d.notes ?? null,
  });
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "shift_assignment", entityId: id });
  return NextResponse.json(jsonSafe({ id }));
}

export async function DELETE(req: Request) {
  const g = await guard("schedules", "update");
  if (g.error) return g.error;
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId");
  const workDate = url.searchParams.get("workDate");
  if (!employeeId || !workDate) return NextResponse.json({ error: "employeeId dan workDate wajib" }, { status: 400 });
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const denied = await assertOutletCrew(sql, employeeId, ids);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const rows = await sql`
    DELETE FROM shift_assignments
    WHERE employee_id = ${employeeId}::bigint AND work_date = ${workDate}::date
    RETURNING id
  `;
  const id = rows[0] ? String((rows[0] as { id: string }).id) : null;
  if (id) {
    await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "shift_assignment", entityId: id });
  }
  return NextResponse.json({ ok: true, id });
}
