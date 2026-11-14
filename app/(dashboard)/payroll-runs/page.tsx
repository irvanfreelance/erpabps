import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { GET as list } from "@/app/api/payroll-runs/route";
import { GET as groups } from "@/app/api/pay-groups/route";
import { PayrollRunsWorkspace, RunRow, PayGroupOption } from "@/components/hrd/payroll-runs-workspace";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Payroll Runs" };

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/employees");

  const [{ rows }, g] = await Promise.all([
    fromRoute<{ rows: RunRow[] }>(await list()),
    fromRoute<{ rows: PayGroupOption[] }>(await groups()),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--primary)]">Payroll Runs</h1>
        <p className="text-[13px] text-gray-500">
          Kelola siklus penggajian bulanan (Outlet & Kantor) dan pekanan (Crew Dapur). Setiap siklus dikalkulasi secara terpisah sesuai aturan kerja masing-masing.
        </p>
      </div>

      <PayrollRunsWorkspace runs={rows} payGroups={g.rows} />
    </div>
  );
}
