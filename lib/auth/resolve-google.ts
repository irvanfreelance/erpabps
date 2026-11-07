import { getDb } from "@/lib/db";
import { adminEmailFromEnv, ensureEmployeeUser, ensureSuperadminUser } from "@/lib/hrd/employee-user";
import type { Role, SessionUser } from "@/types/auth";

function asId(v: unknown) {
  return v == null ? null : String(v);
}

export async function resolveGoogleIdentity(emailRaw: string, displayName: string): Promise<SessionUser | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return null;
  const sql = getDb();
  const adminEmail = adminEmailFromEnv();

  if (adminEmail && email === adminEmail) {
    const admin = await ensureSuperadminUser(sql, email, displayName || "Superadmin");
    const emp = await sql`
      SELECT id FROM employees
      WHERE deleted_at IS NULL
        AND (user_id = ${admin.id}::bigint OR lower(email) = ${email})
      LIMIT 1
    `;
    const employeeId = asId((emp[0] as { id?: string } | undefined)?.id);
    if (employeeId) await ensureEmployeeUser(sql, employeeId);
    return {
      id: admin.id,
      nama: admin.nama,
      email: admin.email,
      role: "superadmin",
      employeeId,
    };
  }

  const admins = await sql`
    SELECT id, nama, email, role
    FROM users
    WHERE lower(email) = ${email}
      AND role = 'superadmin'
      AND deleted_at IS NULL
    LIMIT 1
  `;
  const admin = admins[0] as { id: string; nama: string; email: string; role: Role } | undefined;
  if (admin) {
    const emp = await sql`
      SELECT id FROM employees
      WHERE deleted_at IS NULL
        AND (user_id = ${admin.id}::bigint OR lower(email) = ${email})
      LIMIT 1
    `;
    await sql`
      UPDATE users
      SET is_active = TRUE, last_login_at = now(), updated_at = now()
      WHERE id = ${admin.id}::bigint
    `;
    return {
      id: String(admin.id),
      nama: admin.nama,
      email: admin.email,
      role: "superadmin",
      employeeId: asId((emp[0] as { id?: string } | undefined)?.id),
    };
  }

  const emps = await sql`
    SELECT id FROM employees
    WHERE deleted_at IS NULL AND email IS NOT NULL AND lower(email) = ${email}
    LIMIT 1
  `;
  const empId = asId((emps[0] as { id?: string } | undefined)?.id);
  if (!empId) return null;

  const userId = await ensureEmployeeUser(sql, empId);
  if (!userId) return null;
  const users = await sql`
    SELECT id, nama, email, role FROM users WHERE id = ${userId}::bigint LIMIT 1
  `;
  const user = users[0] as { id: string; nama: string; email: string; role: Role };
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}::bigint`;
  return {
    id: String(user.id),
    nama: user.nama,
    email: user.email,
    role: user.role,
    employeeId: empId,
  };
}
