import { GET as listEmployees } from "@/app/api/employees/route";
import { GET as listLocations } from "@/app/api/locations/route";
import { GET as listPayGroups } from "@/app/api/pay-groups/route";
import { GET as listEmployeeTypes } from "@/app/api/employee-types/route";
import { GET as listPositions } from "@/app/api/positions/route";
import { GET as listRanks } from "@/app/api/ranks/route";
import { GET as listStages } from "@/app/api/contract-stage-options/route";
import { GET as listComponents } from "@/app/api/salary-components/route";
import { EmployeeProfile } from "@/components/hrd/employee-profile";
import { redirect } from "next/navigation";
import { fromRoute } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Karyawan baru — ABPS" };

type Opt = { id: string; name: string };

export default async function Page() {
  const session = await getServerSession();
  if (session?.user.role !== "superadmin") redirect("/employees");
  const [emp, positions, ranks, groups, locations, stages, comps, types] = await Promise.all([
    fromRoute<{ rows: { id: string; full_name: string }[] }>(await listEmployees()),
    fromRoute<{ rows: Opt[] }>(await listPositions()),
    fromRoute<{ rows: Opt[] }>(await listRanks()),
    fromRoute<{ rows: Opt[] }>(await listPayGroups()),
    fromRoute<{ rows: Opt[] }>(await listLocations()),
    fromRoute<{ rows: { id: string; name: string; code: string }[] }>(await listStages()),
    fromRoute<{ rows: { id: string; name: string; code: string }[] }>(await listComponents()),
    fromRoute<{ rows: { id: string; code: string; name: string }[] }>(await listEmployeeTypes()),
  ]);
  return (
    <EmployeeProfile
      mode="create"
      catalogs={{
        positions: positions.rows,
        ranks: ranks.rows,
        payGroups: groups.rows,
        locations: locations.rows,
        employeeTypes: types.rows.map((t) => ({ value: t.code, label: t.name })),
        supervisors: emp.rows.map((r) => ({ id: r.id, name: r.full_name })),
        salaryComponents: comps.rows.map((c) => ({ id: c.id, name: `${c.code} — ${c.name}` })),
        stages: stages.rows,
      }}
    />
  );
}
