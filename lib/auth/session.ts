import { getServerSession as getNextAuthSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminEmailFromEnv } from "@/lib/hrd/employee-user";
import type { Role, SessionUser } from "@/types/auth";

const ROLES: Role[] = ["superadmin", "superordinat", "subordinat"];

function asRole(v: unknown): Role | null {
  return typeof v === "string" && (ROLES as string[]).includes(v) ? (v as Role) : null;
}

function fromJwt(session: { user?: Partial<SessionUser> } | null): { user: SessionUser } | null {
  const user = session?.user;
  const role = asRole(user?.role);
  const email = user?.email?.trim().toLowerCase();
  if (!user?.id || !role || !email) return null;
  return {
    user: {
      id: user.id,
      nama: user.nama ?? email,
      email,
      role,
      employeeId: user.employeeId ?? null,
    },
  };
}

export async function getServerSession(): Promise<{ user: SessionUser } | null> {
  let session: Awaited<ReturnType<typeof getNextAuthSession>> = null;
  try {
    session = await getNextAuthSession(authOptions);
  } catch {
    return null;
  }
  const jwtSession = fromJwt(session);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return jwtSession;

  try {
    const sql = getDb();
    const adminEmail = adminEmailFromEnv();
    const rows = await sql`
      SELECT id, nama, email, role
      FROM users
      WHERE lower(email) = ${email} AND deleted_at IS NULL
      LIMIT 1
    `;
    const row = rows[0] as { id: string; nama: string; email: string; role: string } | undefined;
    if (!row) {
      if (adminEmail && email === adminEmail && jwtSession) {
        return { user: { ...jwtSession.user, role: "superadmin" } };
      }
      return jwtSession;
    }
    const role: Role =
      row.role === "superadmin" || (adminEmail && email === adminEmail) ? "superadmin" : (asRole(row.role) ?? "subordinat");
    const emp = await sql`
      SELECT id FROM employees
      WHERE deleted_at IS NULL AND (user_id = ${row.id}::bigint OR lower(email) = ${email})
      LIMIT 1
    `;
    return {
      user: {
        id: String(row.id),
        nama: row.nama,
        email: row.email,
        role,
        employeeId: emp[0] ? String((emp[0] as { id: string }).id) : null,
      },
    };
  } catch {
    return jwtSession;
  }
}
