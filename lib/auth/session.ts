import { getServerSession as getNextAuthSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminEmailFromEnv, ensureEmployeeUser } from "@/lib/hrd/employee-user";
import { getImpersonatedEmployeeId } from "@/lib/auth/impersonate";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null;
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
      SELECT id, nama, email, role, is_active
      FROM users
      WHERE lower(email) = ${email} AND deleted_at IS NULL
      LIMIT 1
    `;
    const row = rows[0] as { id: string; nama: string; email: string; role: string; is_active: boolean } | undefined;
    if (!row) {
      if (adminEmail && email === adminEmail && jwtSession) {
        return { user: { ...jwtSession.user, role: "superadmin" } };
      }
      return null;
    }
    if (!row.is_active) {
      return null;
    }

    const emp = await sql`
      SELECT id FROM employees
      WHERE deleted_at IS NULL AND (user_id = ${row.id}::bigint OR lower(email) = ${email})
      LIMIT 1
    `;
    const empId = emp[0] ? String((emp[0] as { id: string }).id) : undefined;

    let realRole: Role = "subordinat";
    if (row.role === "superadmin" || (adminEmail && email === adminEmail)) {
      realRole = "superadmin";
    } else if (empId) {
      const hasSub = await sql`
        SELECT 1 FROM employees
        WHERE supervisor_employee_id = ${empId}::bigint AND deleted_at IS NULL
        LIMIT 1
      `;
      realRole = hasSub[0] ? "superordinat" : "subordinat";
    } else {
      realRole = asRole(row.role) ?? "subordinat";
    }
    const realEmployeeId = emp[0] ? String((emp[0] as { id: string }).id) : null;

    const realUser: SessionUser = {
      id: String(row.id),
      nama: row.nama,
      email: row.email,
      role: realRole,
      employeeId: realEmployeeId,
    };

    // Impersonation check: Hanya jika user aslinya adalah superadmin
    if (realRole === "superadmin") {
      const impEmpId = await getImpersonatedEmployeeId();
      if (impEmpId) {
        // Cari data karyawan target
        const targetEmp = await sql`
          SELECT e.id, e.full_name, e.email, e.user_id,
            (SELECT COUNT(*) FROM employees k WHERE k.supervisor_employee_id = e.id AND k.deleted_at IS NULL) as sub_count
          FROM employees e
          WHERE e.id = ${impEmpId}::bigint AND e.deleted_at IS NULL
          LIMIT 1
        `;
        const t = targetEmp[0] as { id: string; full_name: string; email: string | null; user_id: string | null; sub_count: string | number } | undefined;
        if (t) {
          // Buat atau dapatkan user_id jika belum ada akun login
          let targetUserId = t.user_id ? String(t.user_id) : null;
          if (!targetUserId && t.email) {
            targetUserId = await ensureEmployeeUser(sql, String(t.id));
          }

          const hasSubordinates = Number(t.sub_count || 0) > 0;
          const impersonatedRole: Role = hasSubordinates ? "superordinat" : "subordinat";

          return {
            user: {
              id: targetUserId || `emp_${t.id}`,
              nama: t.full_name,
              email: t.email || `karyawan_${t.id}@internal.abps`,
              role: impersonatedRole,
              employeeId: String(t.id),
              impersonatedBy: {
                id: realUser.id,
                nama: realUser.nama,
                email: realUser.email,
              },
            },
          };
        }
      }
    }

    return { user: realUser };
  } catch {
    return jwtSession;
  }
}
