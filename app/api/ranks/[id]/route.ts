import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { rankSchema } from "@/lib/validators/employee";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("ranks", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = rankSchema.partial().safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    UPDATE ranks SET
      code = COALESCE(${parsed.data.code ?? null}, code),
      name = COALESCE(${parsed.data.name ?? null}, name),
      sort_order = COALESCE(${parsed.data.sortOrder ?? null}, sort_order),
      updated_at = now()
    WHERE id = ${id}::bigint AND deleted_at IS NULL
    RETURNING id, code, name, sort_order
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "rank", entityId: id });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("ranks", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  await sql`UPDATE ranks SET deleted_at = now(), updated_at = now() WHERE id = ${id}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "rank", entityId: id });
  return NextResponse.json({ ok: true });
}
