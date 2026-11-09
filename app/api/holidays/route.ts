import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  holidayDate: z.string().min(10),
  name: z.string().min(1),
  isSunday: z.boolean().optional(),
});

export async function GET() {
  const g = await guard("holidays", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT id, to_char(holiday_date, 'YYYY-MM-DD') AS holiday_date, name, is_sunday
    FROM holidays
    ORDER BY holiday_date DESC
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const body = await req.json();
  const sql = getDb();

  // Hapus Hari Libur
  if (body?.action === "delete" && body?.id) {
    const g = await guard("holidays", "create");
    if (g.error) return g.error;
    const rows = await sql`
      DELETE FROM holidays WHERE id = ${body.id}::bigint RETURNING id, holiday_date, name
    `;
    await logAudit({
      userId: g.session!.user.id,
      action: "delete",
      entityType: "holiday",
      entityId: String(body.id),
    });
    return NextResponse.json(jsonSafe(rows[0] ?? {}));
  }

  // Tambah / Ubah Hari Libur
  const g = await guard("holidays", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const dateObj = new Date(parsed.data.holidayDate);
  const isSunday = dateObj.getUTCDay() === 0 || Boolean(parsed.data.isSunday);

  const rows = await sql`
    INSERT INTO holidays (holiday_date, name, is_sunday)
    VALUES (${parsed.data.holidayDate}::date, ${parsed.data.name}, ${isSunday})
    ON CONFLICT (holiday_date) DO UPDATE SET
      name = EXCLUDED.name,
      is_sunday = EXCLUDED.is_sunday
    RETURNING id, holiday_date, name, is_sunday
  `;
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "holiday",
    entityId: String((rows[0] as { id: string }).id),
  });
  return NextResponse.json(jsonSafe(rows[0]));
}
