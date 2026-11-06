import { getDb } from "@/lib/db";
import type { SessionUser } from "@/types/auth";

export async function getServerSession(): Promise<{ user: SessionUser }> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, nama, email, role
    FROM users
    WHERE role = 'admin' AND deleted_at IS NULL AND is_active = TRUE
    ORDER BY id
    LIMIT 1
  `;
  const row = rows[0] as { id: string; nama: string; email: string; role: SessionUser["role"] } | undefined;
  if (!row) {
    return {
      user: {
        id: "0",
        nama: "Admin Sistem",
        email: process.env.ADMIN_EMAIL ?? "admin@rn.org",
        role: "admin",
      },
    };
  }
  return {
    user: {
      id: String(row.id),
      nama: row.nama,
      email: row.email,
      role: row.role,
    },
  };
}
