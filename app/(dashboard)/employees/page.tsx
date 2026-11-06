import { GET as listEmployees } from "@/app/api/employees/route";
import { EmployeesWorkspace } from "@/components/hrd/employees-workspace";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Karyawan — ABPS" };

export default async function Page() {
  const emp = await fromRoute<{ rows: never[] }>(await listEmployees());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)] md:text-[24px]">Karyawan ({emp.rows.length})</h1>
      <EmployeesWorkspace rows={emp.rows as never[]} />
    </div>
  );
}
