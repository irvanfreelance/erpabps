import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { createUserSchema } from "@/lib/validators/user";

export async function GET() {
  const g = await guard("users", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT id, nama, email, role, is_active, last_login_at, created_at FROM users WHERE deleted_at IS NULL ORDER BY id`;
  return NextResponse.json({ rows: jsonSafe(rows) });
}

export async function POST(req: Request) {
  const g = await guard("users", "config");
  if (g.error) return g.error;
  const parsed = createUserSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const passwordHash = await hash(parsed.data.password, 12);
  try {
    const sql = getDb();
    const rows = await sql`
      INSERT INTO users (nama, email, password_hash, role, is_active)
      VALUES (${parsed.data.nama}, ${parsed.data.email}, ${passwordHash}, ${parsed.data.role}, ${parsed.data.isActive ?? true})
      RETURNING id, nama, email, role, is_active, last_login_at, created_at
    `;
    const row = jsonSafe(rows[0]);
    await logAudit({
      userId: g.session!.user.id,
      action: "create",
      entityType: "user",
      valueAfter: { email: parsed.data.email, role: parsed.data.role },
    });
    return NextResponse.json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("users_email") || msg.includes("unique")) {
      return NextResponse.json({ error: "Email sudah dipakai" }, { status: 409 });
    }
    throw err;
  }
}
