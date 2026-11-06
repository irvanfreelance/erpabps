import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { tagSchema } from "@/lib/validators/tag";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("tags", "config");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = tagSchema.partial().safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    UPDATE tag_definitions SET
      nama = COALESCE(${parsed.data.nama ?? null}, nama),
      warna = COALESCE(${parsed.data.warna ?? null}, warna),
      deskripsi = COALESCE(${parsed.data.deskripsi ?? null}, deskripsi),
      is_active = COALESCE(${parsed.data.isActive ?? null}, is_active),
      updated_at = now()
    WHERE id = ${id}::bigint
    RETURNING *
  `;
  const row = jsonSafe(rows[0] ?? null);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({
    userId: g.session!.user.id,
    action: "update",
    entityType: "tag",
    entityId: id,
    valueAfter: parsed.data,
  });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("tags", "config");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  const usage = await sql`
    SELECT COUNT(*)::int AS n FROM donors
    WHERE deleted_at IS NULL AND tags @> ARRAY[(SELECT slug FROM tag_definitions WHERE id = ${id}::bigint)]
  `;
  const n = (usage[0] as { n: number }).n;
  let result: { deactivated: true; used: number } | { deleted: true; used: number };
  if (n > 0) {
    await sql`UPDATE tag_definitions SET is_active = FALSE, updated_at = now() WHERE id = ${id}::bigint`;
    result = { deactivated: true, used: n };
  } else {
    await sql`DELETE FROM tag_definitions WHERE id = ${id}::bigint`;
    result = { deleted: true, used: 0 };
  }
  await logAudit({
    userId: g.session!.user.id,
    action: "delete",
    entityType: "tag",
    entityId: id,
    valueAfter: result,
  });
  return NextResponse.json(result);
}
