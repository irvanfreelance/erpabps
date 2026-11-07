import type { SessionUser } from "@/types/auth";
import type { SqlClient } from "@/lib/db";

export async function actorUserId(sql: SqlClient, user: SessionUser): Promise<string | null> {
  if (user.id && user.id !== "0") return user.id;
  const admin = await sql`
    SELECT id FROM users
    WHERE role = 'superadmin' AND deleted_at IS NULL AND is_active = TRUE
    ORDER BY id LIMIT 1
  `;
  if (admin[0]) return String((admin[0] as { id: string }).id);
  const anyUser = await sql`
    SELECT id FROM users WHERE deleted_at IS NULL ORDER BY id LIMIT 1
  `;
  return anyUser[0] ? String((anyUser[0] as { id: string }).id) : null;
}
