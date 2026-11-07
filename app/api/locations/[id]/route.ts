import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  radiusMeter: z.number().int().min(1).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("locations", "read");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  const rows = await sql`
    SELECT id, code, name, address, latitude, longitude, radius_meter
    FROM locations WHERE id = ${id}::bigint AND deleted_at IS NULL
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("locations", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const setLat = d.latitude !== undefined ? 1 : 0;
  const setLng = d.longitude !== undefined ? 1 : 0;
  const sql = getDb();
  const rows = await sql`
    UPDATE locations SET
      code = COALESCE(${d.code ?? null}, code),
      name = COALESCE(${d.name ?? null}, name),
      address = COALESCE(${d.address ?? null}, address),
      latitude = CASE WHEN ${setLat} = 1 THEN ${d.latitude ?? null} ELSE latitude END,
      longitude = CASE WHEN ${setLng} = 1 THEN ${d.longitude ?? null} ELSE longitude END,
      radius_meter = COALESCE(${d.radiusMeter ?? null}, radius_meter),
      updated_at = now()
    WHERE id = ${id}::bigint AND deleted_at IS NULL
    RETURNING id, code, name, address, latitude, longitude, radius_meter
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "location", entityId: id });
  return NextResponse.json(jsonSafe(rows[0]));
}
