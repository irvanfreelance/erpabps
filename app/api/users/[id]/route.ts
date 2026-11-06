import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { updateUserSchema } from "@/lib/validators/user";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("users", "config");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = updateUserSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const passwordHash =
    parsed.data.password && parsed.data.password.length >= 8 ? await hash(parsed.data.password, 12) : undefined;
  const sql = getDb();
  const rows = await sql`
    UPDATE users SET
      nama = COALESCE(${parsed.data.nama ?? null}, nama),
      email = COALESCE(${parsed.data.email ?? null}, email),
      password_hash = COALESCE(${passwordHash ?? null}, password_hash),
      role = COALESCE(${parsed.data.role ?? null}, role),
      is_active = COALESCE(${parsed.data.isActive ?? null}, is_active),
      updated_at = now()
    WHERE id = ${id}::bigint AND deleted_at IS NULL
    RETURNING id, nama, email, role, is_active, last_login_at, created_at
  `;
  const row = jsonSafe(rows[0] ?? null);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit({
    userId: g.session!.user.id,
    action: "update",
    entityType: "user",
    entityId: id,
    valueAfter: { email: parsed.data.email, role: parsed.data.role },
  });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("users", "config");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  if (id === g.session!.user.id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 });
  }
  const sql = getDb();
  await sql`UPDATE users SET deleted_at = now(), is_active = FALSE, updated_at = now() WHERE id = ${id}::bigint`;
  await logAudit({
    userId: g.session!.user.id,
    action: "delete",
    entityType: "user",
    entityId: id,
  });
  return NextResponse.json({ success: true });
}
