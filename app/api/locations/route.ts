import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  radiusMeter: z.number().int().min(1).optional(),
});

export async function GET() {
  const g = await guard("locations", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT id, code, name, address, latitude, longitude, radius_meter, created_at
    FROM locations WHERE deleted_at IS NULL ORDER BY name
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("locations", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const sql = getDb();
  const rows = await sql`
    INSERT INTO locations (code, name, address, latitude, longitude, radius_meter)
    VALUES (
      ${d.code},
      ${d.name},
      ${d.address ?? null},
      ${d.latitude ?? null},
      ${d.longitude ?? null},
      ${d.radiusMeter ?? 100}
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      radius_meter = EXCLUDED.radius_meter,
      updated_at = now()
    RETURNING id, code, name, address, latitude, longitude, radius_meter
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "location", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
