import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { SqlClient } from "@/lib/db";
import type { Role } from "@/types/auth";

async function dummyHash() {
  return hash(randomBytes(32).toString("hex"), 12);
}

async function roleForEmployee(sql: SqlClient, employeeId: string): Promise<Role> {
  const kids = await sql`
    SELECT 1 FROM employees
    WHERE deleted_at IS NULL AND supervisor_employee_id = ${employeeId}::bigint
    LIMIT 1
  `;
  return kids[0] ? "superordinat" : "subordinat";
}

export function adminEmailFromEnv() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
}

export async function ensureSuperadminUser(
  sql: SqlClient,
  email: string,
  nama: string,
): Promise<{ id: string; nama: string; email: string; role: "superadmin" }> {
  const existing = await sql`
    SELECT id, nama, email FROM users
    WHERE lower(email) = ${email} AND deleted_at IS NULL
    LIMIT 1
  `;
  const row = existing[0] as { id: string; nama: string; email: string } | undefined;
  if (row) {
    await sql`
      UPDATE users
      SET role = 'superadmin', is_active = TRUE, last_login_at = now(), updated_at = now()
      WHERE id = ${row.id}::bigint
    `;
    return { id: String(row.id), nama: row.nama, email: row.email, role: "superadmin" };
  }
  const passwordHash = await dummyHash();
  const created = await sql`
    INSERT INTO users (nama, email, password_hash, role, is_active, last_login_at)
    VALUES (${nama || "Superadmin"}, ${email}, ${passwordHash}, 'superadmin', TRUE, now())
    RETURNING id, nama, email
  `;
  const user = created[0] as { id: string; nama: string; email: string };
  return { id: String(user.id), nama: user.nama, email: user.email, role: "superadmin" };
}

/** Satu karyawan aktif ber-email = satu baris users (employees.user_id UNIQUE). */
export async function ensureEmployeeUser(sql: SqlClient, employeeId: string) {
  const rows = await sql`
    SELECT id, full_name, email, user_id
    FROM employees
    WHERE id = ${employeeId}::bigint AND deleted_at IS NULL
    LIMIT 1
  `;
  const emp = rows[0] as { id: string; full_name: string; email: string | null; user_id: string | null } | undefined;
  if (!emp?.email) return null;
  const email = emp.email.trim().toLowerCase();
  const adminEmail = adminEmailFromEnv();
  if (adminEmail && email === adminEmail) {
    const admin = await ensureSuperadminUser(sql, email, emp.full_name);
    await sql`
      UPDATE employees
      SET user_id = ${admin.id}::bigint, email = ${email}, has_login = TRUE, updated_at = now()
      WHERE id = ${emp.id}::bigint
    `;
    return admin.id;
  }

  const role = await roleForEmployee(sql, String(emp.id));
  let userId = emp.user_id ? String(emp.user_id) : null;
  if (userId) {
    await sql`
      UPDATE users
      SET email = ${email}, nama = ${emp.full_name}, role = ${role}, updated_at = now()
      WHERE id = ${userId}::bigint AND role <> 'superadmin'
    `;
  } else {
    const existing = await sql`
      SELECT id FROM users
      WHERE lower(email) = ${email} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existing[0]) {
      userId = String((existing[0] as { id: string }).id);
      await sql`
        UPDATE users SET nama = ${emp.full_name}, role = ${role}, updated_at = now()
        WHERE id = ${userId}::bigint AND role <> 'superadmin'
      `;
    } else {
      const passwordHash = await dummyHash();
      const created = await sql`
        INSERT INTO users (nama, email, password_hash, role, is_active)
        VALUES (${emp.full_name}, ${email}, ${passwordHash}, ${role}, TRUE)
        RETURNING id
      `;
      userId = String((created[0] as { id: string }).id);
    }
  }
  await sql`
    UPDATE employees
    SET user_id = ${userId}::bigint, email = ${email}, has_login = TRUE, updated_at = now()
    WHERE id = ${emp.id}::bigint
  `;
  return userId;
}
