import { redirect } from "next/navigation";
import { GET as getEmployee } from "@/app/api/employees/[id]/route";
import { GET as listEmployees } from "@/app/api/employees/route";
import { GET as listLocations } from "@/app/api/locations/route";
import { GET as listPayGroups } from "@/app/api/pay-groups/route";
import { GET as listEmployeeTypes } from "@/app/api/employee-types/route";
import { GET as listPositions } from "@/app/api/positions/route";
import { GET as listRanks } from "@/app/api/ranks/route";
import { GET as listStages } from "@/app/api/contract-stage-options/route";
import { GET as listComponents } from "@/app/api/salary-components/route";
import { EmployeeProfile } from "@/components/hrd/employee-profile";
import { fromRoute, internalRequest, RouteError } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Profil karyawan — ABPS" };

type Opt = { id: string; name: string };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (session?.user.role === "subordinat" && session.user.employeeId && session.user.employeeId !== id) {
    redirect(`/employees/${session.user.employeeId}`);
  }
  let data: {
    employee: never;
    components: never[];
    educations: never[];
    family: never[];
    contracts: never[];
  };
  let emp: { rows: { id: string; full_name: string }[] };
  let positions: { rows: Opt[] };
  let ranks: { rows: Opt[] };
  let groups: { rows: Opt[] };
  let locations: { rows: Opt[] };
  let stages: { rows: { id: string; name: string; code: string }[] };
  let comps: { rows: { id: string; name: string; code: string }[] };
  let types: { rows: { id: string; code: string; name: string }[] };
  try {
    const results = await Promise.all([
      fromRoute(await getEmployee(internalRequest(`/api/employees/${id}`), { params: Promise.resolve({ id }) })),
      fromRoute(await listEmployees()),
      fromRoute(await listPositions()),
      fromRoute(await listRanks()),
      fromRoute(await listPayGroups()),
      fromRoute(await listLocations()),
      fromRoute(await listStages()),
      fromRoute(await listComponents()),
      fromRoute(await listEmployeeTypes()),
    ]);
    data = results[0] as typeof data;
    emp = results[1] as typeof emp;
    positions = results[2] as typeof positions;
    ranks = results[3] as typeof ranks;
    groups = results[4] as typeof groups;
    locations = results[5] as typeof locations;
    stages = results[6] as typeof stages;
    comps = results[7] as typeof comps;
    types = results[8] as typeof types;
  } catch (err) {
    if (err instanceof RouteError && err.status === 401) redirect("/login");
    throw err;
  }
  return (
    <EmployeeProfile
      employee={data.employee}
      components={data.components}
      educations={data.educations}
      family={data.family}
      contracts={data.contracts}
      canEdit={session?.user.role === "superadmin" || session?.user.employeeId === id}
      canEditPay={session?.user.role === "superadmin"}
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
