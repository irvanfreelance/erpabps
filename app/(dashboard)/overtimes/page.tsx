import { GET as listOvertimes } from "@/app/api/overtimes/route";
import { OvertimesManager, OvertimeRow } from "@/components/hrd/overtimes-manager";
import { fromRoute, internalRequest } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";

export const metadata = { title: "Pengajuan Lembur — ABPS" };

export default async function Page() {
  const session = await getServerSession();
  const role = session?.user.role ?? "subordinat";
  const isSupervisorOrAdmin = role === "superadmin" || role === "superordinat";

  const { rows } = await fromRoute<{ rows: OvertimeRow[] }>(
    await listOvertimes(internalRequest("/api/overtimes"))
  );

  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, session!.user);

  // Ambil daftar karyawan bawahan yang visible untuk opsi penugasan
  const emps = (await sql`
    SELECT id, full_name, employee_number
    FROM employees
    WHERE deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR id = ANY(${ids}::bigint[]))
    ORDER BY full_name
  `) as { id: string; full_name: string; employee_number: string | null }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[20px] font-bold text-[var(--primary)]">Pengajuan Lembur</h1>
      </div>

      <OvertimesManager
        rows={rows}
        employees={emps.map((e) => ({
          id: String(e.id),
          full_name: e.full_name,
          employee_number: e.employee_number,
        }))}
        isSupervisorOrAdmin={isSupervisorOrAdmin}
      />
    </div>
  );
}

