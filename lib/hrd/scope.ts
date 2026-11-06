import type { SessionUser } from "@/types/auth";
import type { SqlClient } from "@/lib/db";

export async function visibleEmployeeIds(sql: SqlClient, user: SessionUser): Promise<string[] | null> {
  if (user.role === "superadmin") return null;
  const mine = await sql`
    SELECT id FROM employees
    WHERE user_id = ${user.id}::bigint AND deleted_at IS NULL
    LIMIT 1
  `;
  const myId = mine[0] ? String((mine[0] as { id: string }).id) : null;
  if (user.role === "subordinat") return myId ? [myId] : ["0"];
  if (!myId) return ["0"];
  const rows = await sql`
    SELECT id FROM employees
    WHERE deleted_at IS NULL
      AND (id = ${myId}::bigint OR supervisor_employee_id = ${myId}::bigint)
  `;
  return (rows as { id: string }[]).map((r) => String(r.id));
}

export async function ownEmployeeId(sql: SqlClient, user: SessionUser): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM employees
    WHERE user_id = ${user.id}::bigint AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ? String((rows[0] as { id: string }).id) : null;
}
