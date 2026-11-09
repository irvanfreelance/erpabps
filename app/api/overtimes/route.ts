import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { ownEmployeeId, visibleEmployeeIds } from "@/lib/hrd/scope";
import { resolvePayrollSettings } from "@/lib/hrd/settings";
import { jsonSafe } from "@/lib/utils/serialize";

const createSchema = z.object({
  employeeId: z.string().min(1),
  overtimeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().positive(),
  hourlyRate: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const g = await guard("overtimes", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const user = g.session!.user;
  const ids = await visibleEmployeeIds(sql, user);

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const month = url.searchParams.get("month"); // YYYY-MM

  const rows = await sql`
    SELECT o.id, o.employee_id, e.full_name, e.employee_number,
           p.name AS position_name, l.name AS location_name,
           o.overtime_date, o.duration_minutes, o.payable_hours,
           o.rate_mode, o.flat_rate,
           o.status, o.notes, o.source,
           o.approved_by, u_app.nama AS approver_name, o.approved_at,
           o.requested_by, u_req.nama AS requester_name,
           o.created_at
    FROM overtime_requests o
    JOIN employees e ON e.id = o.employee_id
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN locations l ON l.id = e.location_id
    LEFT JOIN users u_app ON u_app.id = o.approved_by
    LEFT JOIN users u_req ON u_req.id = o.requested_by
    WHERE (${ids}::bigint[] IS NULL OR o.employee_id = ANY(${ids}::bigint[]))
      AND (${status}::varchar IS NULL OR o.status = ${status})
      AND (${month}::varchar IS NULL OR to_char(o.overtime_date, 'YYYY-MM') = ${month})
    ORDER BY o.overtime_date DESC, o.created_at DESC
  `;

  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("overtimes", "create");
  if (g.error) return g.error;
  const sql = getDb();
  const user = g.session!.user;

  // Atasan (superordinat) mengajukan lembur untuk bawahannya, atau HR superadmin mengajukan secara backdate
  if (user.role === "subordinat") {
    return NextResponse.json(
      { error: "Pengajuan lembur diajukan oleh atasan langsung atau HR Superadmin" },
      { status: 403 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 400 });
  }

  const { employeeId, overtimeDate, durationMinutes, hourlyRate, notes } = parsed.data;

  // Validasi bawahan jika atasan (superordinat)
  if (user.role === "superordinat") {
    const myEmpId = user.employeeId ?? (await ownEmployeeId(sql, user));
    const empCheck = await sql`
      SELECT id FROM employees
      WHERE id = ${employeeId}::bigint AND supervisor_employee_id = ${myEmpId}::bigint
    `;
    if (!empCheck[0]) {
      return NextResponse.json({ error: "Anda hanya dapat mengajukan lembur untuk bawahan langsung Anda" }, { status: 403 });
    }
  }

  const emp = (await sql`
    SELECT id, position_id, location_id, pay_group_id
    FROM employees WHERE id = ${employeeId}::bigint
  `)[0] as { id: string; position_id: string | null; location_id: string | null; pay_group_id: string | null } | undefined;

  if (!emp) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

  // Ambil rate lembur jika tidak ditentukan
  let rate = hourlyRate;
  if (!rate) {
    const settings = await resolvePayrollSettings(sql, overtimeDate, {
      employeeId: emp.id,
      positionId: emp.position_id,
      locationId: emp.location_id,
      payGroupId: emp.pay_group_id,
    });
    rate = Number(settings["overtime.hourly_rate"] ?? 25000);
  }

  const payableHours = Number((durationMinutes / 60).toFixed(2));

  const result = await sql`
    INSERT INTO overtime_requests (
      employee_id, overtime_date, duration_minutes,
      rate_mode, flat_rate, payable_hours, source, status,
      requested_by, notes
    ) VALUES (
      ${employeeId}::bigint, ${overtimeDate}::date, ${durationMinutes},
      'flat_per_hour', ${rate}, ${payableHours}, 'supervisor_assignment', 'pending',
      ${user.id}::bigint, ${notes ?? null}
    ) RETURNING id
  `;

  const newId = String(result[0].id);
  await logAudit({
    userId: user.id,
    action: "create_overtime_request",
    entityType: "overtime_request",
    entityId: newId,
    valueAfter: { employeeId, overtimeDate, durationMinutes, rate },
  });

  return NextResponse.json({ success: true, id: newId });
}

export async function PATCH(req: Request) {
  const g = await guard("overtimes", "approve");
  if (g.error) return g.error;
  const sql = getDb();
  const user = g.session!.user;

  const json = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data persetujuan tidak valid" }, { status: 400 });
  }

  const { id, action, notes } = parsed.data;

  const rows = await sql`
    SELECT o.*, e.supervisor_employee_id
    FROM overtime_requests o
    JOIN employees e ON e.id = o.employee_id
    WHERE o.id = ${id}::bigint
  `;
  const existing = rows[0] as
    | {
        id: string;
        employee_id: string;
        status: string;
        supervisor_employee_id: string | null;
      }
    | undefined;

  if (!existing) return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: `Pengajuan sudah ${existing.status}` }, { status: 400 });
  }

  // Jika superordinat, cek apakah dia atasan dari karyawan tsb
  if (user.role === "superordinat") {
    const myEmpId = user.employeeId ?? (await ownEmployeeId(sql, user));
    if (!myEmpId || String(existing.supervisor_employee_id) !== String(myEmpId)) {
      return NextResponse.json({ error: "Hanya atasan langsung atau HR Superadmin yang dapat menyetujui lembur" }, { status: 403 });
    }
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  await sql`
    UPDATE overtime_requests
    SET status = ${newStatus},
        approved_by = ${user.id}::bigint,
        approved_at = now(),
        notes = COALESCE(${notes ?? null}, notes)
    WHERE id = ${id}::bigint
  `;

  await logAudit({
    userId: user.id,
    action: `${action}_overtime_request`,
    entityType: "overtime_request",
    entityId: id,
  });

  return NextResponse.json({ success: true, status: newStatus });
}

