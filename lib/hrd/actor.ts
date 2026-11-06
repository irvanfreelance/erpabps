import type { SessionUser } from "@/types/auth";
import type { SqlClient } from "@/lib/db";

export async function actorUserId(sql: SqlClient, user: SessionUser): Promise<string | null> {
  if (user.id && user.id !== "0") return user.id;
  const rows = await sql`
    SELECT id FROM users
    WHERE role = 'superadmin' AND deleted_at IS NULL AND is_active = TRUE
    ORDER BY id LIMIT 1
  `;
  return rows[0] ? String((rows[0] as { id: string }).id) : null;
}
