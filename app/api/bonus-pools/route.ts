import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { calculateMonthlyBonusPool } from "@/lib/hrd/bonus-calculator";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  poolKind: z.enum(["outlet_revenue", "monthly_component"]),
  payGroupId: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  outletRevenueId: z.string().nullable().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  poolAmount: z.number().positive(),
  noLateBonus: z.number().nonnegative().optional(),
  lateThresholdMinutes: z.number().int().nonnegative().optional(),
  noLeaveBonus: z.number().nonnegative().optional(),
  remainderPopulation: z.enum(["all", "qualified", "outlet_only"]).default("all"),
  sourceRef: z.string().default("manual"),
});

export async function GET() {
  const g = await guard("bonus.monthly", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);

  const rows = await sql`
    SELECT b.id, b.pool_kind, b.period_start, b.period_end, b.pool_amount, b.status, b.source_ref,
           g.name AS pay_group_name, l.name AS location_name
    FROM bonus_pools b
    LEFT JOIN pay_groups g ON g.id = b.pay_group_id
    LEFT JOIN locations l ON l.id = b.location_id
    ORDER BY b.period_end DESC, b.id DESC
  `;

  const alloc = await sql`
    SELECT a.bonus_pool_id, a.employee_id, e.full_name, e.employee_number,
           a.component_code, a.amount, a.reason
    FROM bonus_allocations a
    JOIN employees e ON e.id = a.employee_id
    WHERE ${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[])
    ORDER BY a.bonus_pool_id DESC, e.full_name, a.component_code
  `;

  return NextResponse.json(jsonSafe({ rows, allocations: alloc }));
}

export async function POST(req: Request) {
  const g = await guard("bonus.monthly", "create");
  if (g.error) return g.error;
  if (g.session!.user.role !== "superadmin") {
    return NextResponse.json({ error: "Hanya HR Superadmin yang dapat membuat pool bonus" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return zodError(parsed.error);

  const data = parsed.data;
  const sql = getDb();

  const rows = await sql`
    INSERT INTO bonus_pools (
      pool_kind, pay_group_id, location_id, outlet_revenue_id, period_start, period_end, pool_amount, source_ref, status
    ) VALUES (
      ${data.poolKind}, ${data.payGroupId ?? null}::bigint, ${data.locationId ?? null}::bigint,
      ${data.outletRevenueId ?? null}::bigint, ${data.periodStart}::date, ${data.periodEnd}::date,
      ${data.poolAmount}, ${data.sourceRef}, 'draft'
    )
    RETURNING id
  `;
  const poolId = String(rows[0].id);

  // Jika monthly_component, jalankan kalkulasi breakdown dinamis
  if (data.poolKind === "monthly_component") {
    await calculateMonthlyBonusPool(sql, poolId, {
      poolAmount: data.poolAmount,
      noLateBonus: data.noLateBonus ?? 100000,
      lateThresholdMinutes: data.lateThresholdMinutes ?? 5,
      noLeaveBonus: data.noLeaveBonus ?? 100000,
      remainderPopulation: data.remainderPopulation,
      payGroupId: data.payGroupId,
      locationId: data.locationId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    });
  }

  await logAudit({
    userId: g.session!.user.id,
    action: "create_and_calculate_bonus_pool",
    entityType: "bonus_pool",
    entityId: poolId,
    valueAfter: data,
  });

  return NextResponse.json({ success: true, id: poolId });
}
