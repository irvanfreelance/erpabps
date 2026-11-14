import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { ownEmployeeId, visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

const createSchema = z.object({
  targetEmployeeId: z.string(),
  swapDate: z.string(),
  reason: z.string().optional(),
});

export async function GET() {
  const g = await guard("shift-swaps", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT s.id, to_char(s.swap_date, 'YYYY-MM-DD') AS swap_date, s.status, s.reason,
           s.requester_id, s.target_employee_id,
           r.full_name AS requester_name, t.full_name AS target_name,
           r_st.name AS requester_shift, t_st.name AS target_shift
    FROM shift_swap_requests s
    JOIN employees r ON r.id = s.requester_id
    JOIN employees t ON t.id = s.target_employee_id
    LEFT JOIN shift_assignments r_sa ON r_sa.id = s.requester_assignment_id
    LEFT JOIN shift_templates r_st ON r_st.id = r_sa.shift_template_id
    LEFT JOIN shift_assignments t_sa ON t_sa.id = s.target_assignment_id
    LEFT JOIN shift_templates t_st ON t_st.id = t_sa.shift_template_id
    WHERE ${ids}::bigint[] IS NULL
       OR s.requester_id = ANY(${ids}::bigint[])
       OR s.target_employee_id = ANY(${ids}::bigint[])
    ORDER BY s.created_at DESC
  `;
  return NextResponse.json(jsonSafe({ rows, userRole: g.session!.user.role }));
}

export async function POST(req: Request) {
  const body = await req.json();
  const sql = getDb();

  // Aksi persetujuan (Approve / Reject) dari Atasan / Superadmin
  if (body?.decision) {
    const g = await guard("shift-swaps", "approve");
    if (g.error) return g.error;
    const reqId = String(body.id);
    const decision = body.decision === "approve" ? "approved" : "rejected";

    const existingRows = await sql`
      SELECT s.id, s.status, s.requester_id, s.target_employee_id, s.swap_date,
             s.requester_assignment_id, s.target_assignment_id
      FROM shift_swap_requests s
      WHERE s.id = ${reqId}::bigint
      LIMIT 1
    `;
    const existing = existingRows[0] as {
      id: string;
      status: string;
      requester_id: string;
      target_employee_id: string;
      swap_date: string;
      requester_assignment_id: string | null;
      target_assignment_id: string | null;
    } | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
    }
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Pengajuan tukar shift sudah diputus sebelumnya" }, { status: 409 });
    }
    if (g.session!.user.role !== "superadmin") {
      const actorEmpId = await ownEmployeeId(sql, g.session!.user);
      if (!actorEmpId || String(existing.requester_id) === String(actorEmpId)) {
        return NextResponse.json({ error: "Tidak dapat menyetujui atau menolak pengajuan sendiri" }, { status: 403 });
      }
      const subCheck = await sql`
        SELECT id FROM employees
        WHERE id = ${existing.requester_id}::bigint AND supervisor_employee_id = ${actorEmpId}::bigint
      `;
      if (!subCheck[0]) {
        return NextResponse.json({ error: "Hanya atasan langsung atau superadmin yang dapat memutus pengajuan ini" }, { status: 403 });
      }
    }

    if (decision === "approved") {
      // Tukar shift langsung pada shift_assignments
      // 1. Ambil data template requester & target
      const reqAsg = existing.requester_assignment_id ? (await sql`
        SELECT shift_template_id, start_time, end_time, station_code, day_status
        FROM shift_assignments WHERE id = ${existing.requester_assignment_id}::bigint
      `)[0] as { shift_template_id: string; start_time: string | null; end_time: string | null; station_code: string | null; day_status: string } | undefined : null;

      const tgtAsg = existing.target_assignment_id ? (await sql`
        SELECT shift_template_id, start_time, end_time, station_code, day_status
        FROM shift_assignments WHERE id = ${existing.target_assignment_id}::bigint
      `)[0] as { shift_template_id: string; start_time: string | null; end_time: string | null; station_code: string | null; day_status: string } | undefined : null;

      if (reqAsg && tgtAsg) {
        // Swap template
        await sql`
          UPDATE shift_assignments SET
            shift_template_id = ${tgtAsg.shift_template_id}::bigint,
            start_time = ${tgtAsg.start_time}::time,
            end_time = ${tgtAsg.end_time}::time,
            station_code = ${tgtAsg.station_code},
            day_status = ${tgtAsg.day_status},
            notes = 'Tukar shift dengan ' || ${existing.target_employee_id}::text,
            updated_at = now()
          WHERE id = ${existing.requester_assignment_id}::bigint
        `;
        await sql`
          UPDATE shift_assignments SET
            shift_template_id = ${reqAsg.shift_template_id}::bigint,
            start_time = ${reqAsg.start_time}::time,
            end_time = ${reqAsg.end_time}::time,
            station_code = ${reqAsg.station_code},
            day_status = ${reqAsg.day_status},
            notes = 'Tukar shift dengan ' || ${existing.requester_id}::text,
            updated_at = now()
          WHERE id = ${existing.target_assignment_id}::bigint
        `;
      }
    }

    const rows = await sql`
      UPDATE shift_swap_requests
      SET status = ${decision},
          decided_by = ${g.session!.user.id}::bigint,
          decided_at = now()
      WHERE id = ${reqId}::bigint
      RETURNING id, status
    `;
    await logAudit({
      userId: g.session!.user.id,
      action: decision,
      entityType: "shift_swap",
      entityId: reqId,
      valueAfter: { status: decision },
    });
    return NextResponse.json(jsonSafe(rows[0]));
  }

  // Pengajuan ganti shift oleh bawahan/karyawan
  const g = await guard("shift-swaps", "create");
  if (g.error) return g.error;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const mine = await ownEmployeeId(sql, g.session!.user);
  if (!mine) return NextResponse.json({ error: "Akun ini tidak terhubung ke data karyawan" }, { status: 400 });

  if (mine === parsed.data.targetEmployeeId) {
    return NextResponse.json({ error: "Tidak dapat menukar shift dengan diri sendiri" }, { status: 400 });
  }

  // Cari jadwal pemohon dan target pada tanggal yang dipilih
  const [reqAssignment, tgtAssignment] = await Promise.all([
    sql`
      SELECT id FROM shift_assignments
      WHERE employee_id = ${mine}::bigint AND work_date = ${parsed.data.swapDate}::date
      LIMIT 1
    `,
    sql`
      SELECT id FROM shift_assignments
      WHERE employee_id = ${parsed.data.targetEmployeeId}::bigint AND work_date = ${parsed.data.swapDate}::date
      LIMIT 1
    `,
  ]);

  if (!reqAssignment[0]) {
    return NextResponse.json({ error: "Anda tidak memiliki jadwal shift pada tanggal tersebut" }, { status: 400 });
  }
  if (!tgtAssignment[0]) {
    return NextResponse.json({ error: "Karyawan tujuan tidak memiliki jadwal shift pada tanggal tersebut" }, { status: 400 });
  }

  const reqAsgId = String((reqAssignment[0] as { id: string }).id);
  const tgtAsgId = String((tgtAssignment[0] as { id: string }).id);

  const rows = await sql`
    INSERT INTO shift_swap_requests (
      requester_id, target_employee_id, requester_assignment_id, target_assignment_id, swap_date, reason
    ) VALUES (
      ${mine}::bigint, ${parsed.data.targetEmployeeId}::bigint, ${reqAsgId}::bigint,
      ${tgtAsgId}::bigint, ${parsed.data.swapDate}::date, ${parsed.data.reason ?? null}
    )
    RETURNING id, status
  `;
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "shift_swap",
    entityId: String((rows[0] as { id: string }).id),
  });
  return NextResponse.json(jsonSafe(rows[0]));
}
