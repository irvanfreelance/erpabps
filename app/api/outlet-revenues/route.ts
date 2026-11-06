import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  locationId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  grossAmount: z.number(),
  discountAmount: z.number().optional(),
  ojolAmount: z.number().optional(),
});

export async function GET() {
  const g = await guard("bonus.outlet", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT o.*, l.name AS location_name
    FROM outlet_revenues o JOIN locations l ON l.id = o.location_id
    ORDER BY o.period_end DESC
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("bonus.outlet", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const discount = parsed.data.discountAmount ?? 0;
  const ojol = parsed.data.ojolAmount ?? 0;
  const net = parsed.data.grossAmount - discount - ojol;
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  const rows = await sql`
    INSERT INTO outlet_revenues (
      location_id, period_start, period_end, gross_amount, discount_amount, ojol_amount, net_amount, input_by
    ) VALUES (
      ${parsed.data.locationId}::bigint, ${parsed.data.periodStart}::date, ${parsed.data.periodEnd}::date,
      ${parsed.data.grossAmount}, ${discount}, ${ojol}, ${net}, ${actor}::bigint
    )
    RETURNING *
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "outlet_revenue", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
