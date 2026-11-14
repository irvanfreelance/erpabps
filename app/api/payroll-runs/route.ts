import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { calculateRun } from "@/lib/hrd/payroll";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  payGroupId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  payFrequency: z.enum(["weekly", "monthly"]),
});

export async function GET() {
  const g = await guard("payroll-runs", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT r.id, r.period_start, r.period_end, r.pay_frequency, r.status, r.run_type, g.name AS pay_group_name, g.code AS pay_group_code
    FROM payroll_runs r
    JOIN pay_groups g ON g.id = r.pay_group_id
    ORDER BY r.period_end DESC
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("payroll-runs", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  let id: string;
  try {
    const rows = await sql`
      INSERT INTO payroll_runs (pay_group_id, period_start, period_end, pay_frequency, created_by)
      VALUES (
        ${parsed.data.payGroupId}::bigint, ${parsed.data.periodStart}::date, ${parsed.data.periodEnd}::date,
        ${parsed.data.payFrequency}, ${actor}::bigint
      )
      RETURNING id, status
    `;
    id = String((rows[0] as { id: string }).id);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === "23505") {
      return NextResponse.json({ error: "Run payroll untuk kelompok dan periode ini sudah ada" }, { status: 409 });
    }
    throw err;
  }
  await calculateRun(sql, id, g.session!.user.id);
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "payroll_run", entityId: id });
  return NextResponse.json({ id, status: "calculated" });
}
