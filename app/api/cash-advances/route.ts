import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { ownEmployeeId, visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  employeeId: z.string().optional(),
  amount: z.number().positive(),
  installmentCount: z.number().int().positive(),
  installmentAmount: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const g = await guard("cash-advances", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT c.id, c.employee_id, c.amount, c.installment_count, c.installment_amount,
           c.override_installment_amount,
           c.interval_unit, c.remaining_amount, c.screening_status, c.notes,
           to_char(c.requested_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') AS requested_at_wib,
           e.full_name, e.employee_number,
           u.nama AS screened_by_name
    FROM cash_advances c
    JOIN employees e ON e.id = c.employee_id
    LEFT JOIN users u ON u.id = c.screened_by
    WHERE ${ids}::bigint[] IS NULL OR c.employee_id = ANY(${ids}::bigint[])
    ORDER BY c.requested_at DESC
  `;
  return NextResponse.json(jsonSafe({ rows, userRole: g.session!.user.role }));
}

export async function POST(req: Request) {
  const body = await req.json();
  const sql = getDb();

  // Override cicilan kasbon saat gajian oleh HR Superadmin
  if (body?.override) {
    const g = await guard("cash-advances.screening", "approve");
    if (g.error) return g.error;
    const reqId = String(body.id);
    const overrideAmount = body.overrideInstallmentAmount != null ? Number(body.overrideInstallmentAmount) : null;

    const rows = await sql`
      UPDATE cash_advances
      SET override_installment_amount = ${overrideAmount},
          updated_at = now()
      WHERE id = ${reqId}::bigint
      RETURNING id, installment_amount, override_installment_amount
    `;
    await logAudit({
      userId: g.session!.user.id,
      action: "override_installment",
      entityType: "cash_advance",
      entityId: reqId,
      valueAfter: { overrideInstallmentAmount: overrideAmount },
    });
    return NextResponse.json(jsonSafe(rows[0]));
  }

  // Approval screening kasbon oleh HR Superadmin
  if (body?.screen) {
    const g = await guard("cash-advances.screening", "approve");
    if (g.error) return g.error;
    const actor = await actorUserId(sql, g.session!.user);
    if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
    const status = body.passed ? "passed" : "rejected";
    const rows = await sql`
      UPDATE cash_advances
      SET screening_status = ${status}, screened_by = ${actor}::bigint, screened_at = now(), updated_at = now()
      WHERE id = ${body.id}::bigint
      RETURNING id, screening_status
    `;
    await logAudit({ userId: g.session!.user.id, action: "screen", entityType: "cash_advance", entityId: body.id, valueAfter: { status } });
    return NextResponse.json(jsonSafe(rows[0]));
  }

  // Pengajuan kasbon (berlaku sama untuk subordinat maupun atasan / superordinat)
  const g = await guard("cash-advances", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  let employeeId = parsed.data.employeeId ?? null;
  if (g.session!.user.role !== "superadmin" || !employeeId) {
    employeeId = await ownEmployeeId(sql, g.session!.user);
  }
  if (!employeeId) return NextResponse.json({ error: "Akun ini belum terhubung ke data karyawan" }, { status: 400 });

  const amount = parsed.data.amount;
  const count = parsed.data.installmentCount;
  const calculatedInstallment = parsed.data.installmentAmount || Math.round(amount / count);

  const rows = await sql`
    INSERT INTO cash_advances (
      employee_id, amount, installment_count, installment_amount, interval_unit, interval_every, remaining_amount, notes, screening_status
    ) VALUES (
      ${employeeId}::bigint, ${amount}, ${count}, ${calculatedInstallment},
      'monthly', 1, ${amount}, ${parsed.data.notes ?? null}, 'submitted'
    )
    RETURNING id, screening_status
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "cash_advance", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
