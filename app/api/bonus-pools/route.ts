import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  poolKind: z.enum(["outlet_revenue", "monthly_component"]),
  payGroupId: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  outletRevenueId: z.string().nullable().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  poolAmount: z.number(),
  remainderPopulation: z.string().nullable().optional(),
  sourceRef: z.string().default("manual"),
});

export async function GET() {
  const g = await guard("bonus.monthly", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT b.id, b.pool_kind, b.period_start, b.period_end, b.pool_amount, b.status, b.source_ref
    FROM bonus_pools b
    ORDER BY b.period_end DESC
  `;
  const alloc = await sql`
    SELECT a.bonus_pool_id, a.employee_id, e.full_name, a.component_code, a.amount
    FROM bonus_allocations a
    JOIN employees e ON e.id = a.employee_id
    WHERE ${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[])
  `;
  return NextResponse.json(jsonSafe({ rows, allocations: alloc }));
}

export async function POST(req: Request) {
  const g = await guard("bonus.monthly", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  if (parsed.data.poolKind === "monthly_component" && !parsed.data.remainderPopulation) {
    return NextResponse.json({ error: "Populasi sisa wajib diisi sebelum menghitung bonus bulanan" }, { status: 400 });
  }
  const sql = getDb();
  const rows = await sql`
    INSERT INTO bonus_pools (
      pool_kind, pay_group_id, location_id, outlet_revenue_id, period_start, period_end, pool_amount, source_ref
    ) VALUES (
      ${parsed.data.poolKind}, ${parsed.data.payGroupId ?? null}::bigint, ${parsed.data.locationId ?? null}::bigint,
      ${parsed.data.outletRevenueId ?? null}::bigint, ${parsed.data.periodStart}::date, ${parsed.data.periodEnd}::date,
      ${parsed.data.poolAmount}, ${parsed.data.sourceRef}
    )
    RETURNING id
  `;
  const id = String((rows[0] as { id: string }).id);
  if (parsed.data.remainderPopulation) {
    await sql`
      INSERT INTO bonus_pool_components (bonus_pool_id, code, remainder_population)
      VALUES (${id}::bigint, 'remainder', ${parsed.data.remainderPopulation})
    `;
  }
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "bonus_pool", entityId: id });
  return NextResponse.json({ id });
}
