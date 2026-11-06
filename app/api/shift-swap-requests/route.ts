import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { ownEmployeeId, visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

const createSchema = z.object({
  targetEmployeeId: z.string(),
  requesterAssignmentId: z.string(),
  targetAssignmentId: z.string().nullable().optional(),
  swapDate: z.string(),
  reason: z.string().optional(),
});

export async function GET() {
  const g = await guard("shift-swaps", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT s.id, s.swap_date, s.status, s.reason,
           r.full_name AS requester_name, t.full_name AS target_name
    FROM shift_swap_requests s
    JOIN employees r ON r.id = s.requester_id
    JOIN employees t ON t.id = s.target_employee_id
    WHERE ${ids}::bigint[] IS NULL
       OR s.requester_id = ANY(${ids}::bigint[])
       OR s.target_employee_id = ANY(${ids}::bigint[])
    ORDER BY s.created_at DESC
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body?.decision) {
    const g = await guard("shift-swaps", "approve");
    if (g.error) return g.error;
    const sql = getDb();
    const rows = await sql`
      UPDATE shift_swap_requests
      SET status = ${body.decision === "approve" ? "approved" : "rejected"},
          decided_by = ${g.session!.user.id}::bigint,
          decided_at = now()
      WHERE id = ${body.id}::bigint
      RETURNING id, status
    `;
    await logAudit({ userId: g.session!.user.id, action: "approve", entityType: "shift_swap", entityId: body.id });
    return NextResponse.json(jsonSafe(rows[0]));
  }
  const g = await guard("shift-swaps", "create");
  if (g.error) return g.error;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const mine = await ownEmployeeId(sql, g.session!.user);
  const requester = g.session!.user.role === "superadmin" ? parsed.data.targetEmployeeId : mine;
  if (!requester) return NextResponse.json({ error: "Tidak ada karyawan pada akun" }, { status: 400 });
  const rows = await sql`
    INSERT INTO shift_swap_requests (
      requester_id, target_employee_id, requester_assignment_id, target_assignment_id, swap_date, reason
    ) VALUES (
      ${requester}::bigint, ${parsed.data.targetEmployeeId}::bigint, ${parsed.data.requesterAssignmentId}::bigint,
      ${parsed.data.targetAssignmentId ?? null}::bigint, ${parsed.data.swapDate}::date, ${parsed.data.reason ?? null}
    )
    RETURNING id, status
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "shift_swap", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
