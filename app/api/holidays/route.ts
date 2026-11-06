import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({ holidayDate: z.string(), name: z.string().min(1), isSunday: z.boolean().optional() });

export async function GET() {
  const g = await guard("holidays", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT id, holiday_date, name, is_sunday FROM holidays ORDER BY holiday_date`;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("holidays", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO holidays (holiday_date, name, is_sunday)
    VALUES (${parsed.data.holidayDate}::date, ${parsed.data.name}, ${parsed.data.isSunday ?? false})
    ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, holiday_date, name
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "holiday", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
