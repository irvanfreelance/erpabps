import { redirect } from "next/navigation";
import { GET as listEmployees } from "@/app/api/employees/route";
import { EmployeesWorkspace } from "@/components/hrd/employees-workspace";
import { fromRoute } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Karyawan — ABPS" };

export default async function Page() {
  const session = await getServerSession();
  if (session?.user.role === "subordinat" && session.user.employeeId && !session.user.impersonatedBy) {
    redirect(`/employees/${session.user.employeeId}`);
  }
  const emp = await fromRoute<{ rows: never[] }>(await listEmployees());
  const isSuperadmin = session?.user.role === "superadmin" || Boolean(session?.user.impersonatedBy);
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)] md:text-[24px]">Karyawan ({emp.rows.length})</h1>
      <EmployeesWorkspace
        rows={emp.rows as never[]}
        canManage={session?.user.role === "superadmin"}
        isSuperadmin={isSuperadmin}
      />
    </div>
  );
}
