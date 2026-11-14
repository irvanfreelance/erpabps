import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { ownEmployeeId, visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

const createSchema = z.object({
  leaveType: z.enum(["cuti", "izin", "sakit", "off"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(3, "Alasan minimal 3 karakter"),
});

export async function GET() {
  const g = await guard("leaves", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);

  const rows = await sql`
    SELECT l.id, l.employee_id, l.leave_type,
           to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
           to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
           l.reason, l.status, l.created_at,
           e.full_name AS employee_name, e.employee_number,
           u.nama AS reviewer_name,
           to_char(l.reviewed_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') AS reviewed_at_wib
    FROM leave_requests l
    JOIN employees e ON e.id = l.employee_id
    LEFT JOIN users u ON u.id = l.reviewed_by
    WHERE ${ids}::bigint[] IS NULL OR l.employee_id = ANY(${ids}::bigint[])
    ORDER BY l.created_at DESC
  `;

  return NextResponse.json(jsonSafe({ rows, userRole: g.session!.user.role }));
}

export async function POST(req: Request) {
  const body = await req.json();
  const sql = getDb();

  // Persetujuan atasan / superadmin
  if (body?.decision) {
    const g = await guard("leaves", "approve");
    if (g.error) return g.error;
    const reqId = String(body.id);
    const decision = body.decision === "approve" ? "approved" : "rejected";

    const existingRows = await sql`
      SELECT id, employee_id, status FROM leave_requests WHERE id = ${reqId}::bigint
    `;
    const existing = existingRows[0] as { id: string; employee_id: string; status: string } | undefined;
    if (!existing) {
      return NextResponse.json({ error: "Pengajuan cuti tidak ditemukan" }, { status: 404 });
    }
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Pengajuan cuti sudah diputus sebelumnya" }, { status: 409 });
    }

    if (g.session!.user.role !== "superadmin") {
      const actorEmpId = await ownEmployeeId(sql, g.session!.user);
      if (!actorEmpId || String(existing.employee_id) === String(actorEmpId)) {
        return NextResponse.json({ error: "Tidak dapat menyetujui atau menolak pengajuan sendiri" }, { status: 403 });
      }
      const subCheck = await sql`
        SELECT id FROM employees
        WHERE id = ${existing.employee_id}::bigint AND supervisor_employee_id = ${actorEmpId}::bigint
      `;
      if (!subCheck[0]) {
        return NextResponse.json({ error: "Hanya atasan langsung atau superadmin yang dapat memutus pengajuan ini" }, { status: 403 });
      }
    }

    const rows = await sql`
      UPDATE leave_requests
      SET status = ${decision},
          reviewed_by = ${g.session!.user.id}::bigint,
          reviewed_at = now()
      WHERE id = ${reqId}::bigint AND status = 'pending'
      RETURNING id, status, employee_id, start_date, end_date, leave_type
    `;
    const updated = rows[0] as {
      id: string;
      status: string;
      employee_id: string;
      start_date: string;
      end_date: string;
      leave_type: string;
    } | undefined;

    if (!updated) {
      return NextResponse.json({ error: "Pengajuan cuti sudah diputus" }, { status: 409 });
    }

    // Jika disetujui, upsert jadwal shift_assignments pada rentang tanggal cuti menjadi 'off' / 'off_izin' / 'off_sakit'
    if (decision === "approved") {
      const dayStatus = updated.leave_type === "sakit" ? "off_sakit" : updated.leave_type === "izin" ? "off_izin" : "off";
      const noteText = `Cuti/Izin (${updated.leave_type}) disetujui`;
      await sql`
        UPDATE shift_assignments
        SET day_status = ${dayStatus},
            notes = ${noteText},
            updated_at = now()
        WHERE employee_id = ${updated.employee_id}::bigint
          AND work_date BETWEEN ${updated.start_date}::date AND ${updated.end_date}::date
      `;
      await sql`
        INSERT INTO shift_assignments (employee_id, work_date, day_status, notes)
        SELECT ${updated.employee_id}::bigint, d::date, ${dayStatus}, ${noteText}
        FROM generate_series(${updated.start_date}::date, ${updated.end_date}::date, '1 day'::interval) AS d
        WHERE NOT EXISTS (
          SELECT 1 FROM shift_assignments sa
          WHERE sa.employee_id = ${updated.employee_id}::bigint AND sa.work_date = d::date
        )
      `;
    }

    await logAudit({
      userId: g.session!.user.id,
      action: decision,
      entityType: "leave_request",
      entityId: reqId,
      valueAfter: { status: decision },
    });
    return NextResponse.json(jsonSafe(rows[0]));
  }

  // Pengajuan cuti oleh karyawan / subordinat
  const g = await guard("leaves", "create");
  if (g.error) return g.error;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const mine = await ownEmployeeId(sql, g.session!.user);
  if (!mine) {
    return NextResponse.json({ error: "Akun ini tidak terhubung ke karyawan" }, { status: 400 });
  }

  if (parsed.data.endDate < parsed.data.startDate) {
    return NextResponse.json({ error: "Tanggal akhir tidak boleh lebih awal dari tanggal mulai" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO leave_requests (
      employee_id, leave_type, start_date, end_date, reason, status
    ) VALUES (
      ${mine}::bigint, ${parsed.data.leaveType}, ${parsed.data.startDate}::date,
      ${parsed.data.endDate}::date, ${parsed.data.reason}, 'pending'
    )
    RETURNING id, status
  `;

  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "leave_request",
    entityId: String((rows[0] as { id: string }).id),
  });

  return NextResponse.json(jsonSafe(rows[0]));
}
