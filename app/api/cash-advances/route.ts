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
  installmentAmount: z.number().positive(),
  intervalUnit: z.enum(["weekly", "monthly", "custom"]),
  intervalEvery: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const g = await guard("cash-advances", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT c.id, c.amount, c.installment_count, c.installment_amount, c.interval_unit,
           c.remaining_amount, c.screening_status, c.requested_at, e.full_name
    FROM cash_advances c
    JOIN employees e ON e.id = c.employee_id
    WHERE ${ids}::bigint[] IS NULL OR c.employee_id = ANY(${ids}::bigint[])
    ORDER BY c.requested_at DESC
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body?.screen) {
    const g = await guard("cash-advances.screening", "approve");
    if (g.error) return g.error;
    const sql = getDb();
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
  const g = await guard("cash-advances", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  let employeeId = parsed.data.employeeId ?? null;
  if (g.session!.user.role !== "superadmin") {
    employeeId = await ownEmployeeId(sql, g.session!.user);
  }
  if (!employeeId) return NextResponse.json({ error: "Karyawan wajib" }, { status: 400 });
  const rows = await sql`
    INSERT INTO cash_advances (
      employee_id, amount, installment_count, installment_amount, interval_unit, interval_every, remaining_amount, notes
    ) VALUES (
      ${employeeId}::bigint, ${parsed.data.amount}, ${parsed.data.installmentCount}, ${parsed.data.installmentAmount},
      ${parsed.data.intervalUnit}, ${parsed.data.intervalEvery ?? 1}, ${parsed.data.amount}, ${parsed.data.notes ?? null}
    )
    RETURNING id, screening_status
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "cash_advance", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
