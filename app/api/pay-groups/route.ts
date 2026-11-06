import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  payFrequency: z.enum(["weekly", "monthly"]),
});

export async function GET() {
  const g = await guard("pay-groups", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT id, code, name, pay_frequency, payday_day, payday_dow FROM pay_groups ORDER BY name`;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("pay-groups", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const weekly = parsed.data.payFrequency === "weekly";
  const rows = await sql`
    INSERT INTO pay_groups (code, name, pay_frequency, week_start_dow, payday_day)
    VALUES (
      ${parsed.data.code}, ${parsed.data.name}, ${parsed.data.payFrequency},
      ${weekly ? 6 : null}, ${weekly ? null : 1}
    )
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, code, name, pay_frequency
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "pay_group", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
