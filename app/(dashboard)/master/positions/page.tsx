import { GET as depts } from "@/app/api/departments/route";
import { GET as list } from "@/app/api/positions/route";
import { PositionsManager } from "@/components/hrd/positions-manager";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Jabatan — ABPS" };

export default async function Page() {
  const [{ rows }, d] = await Promise.all([
    fromRoute<{ rows: { id: string; code: string; name: string; payroll_type: string; department_name: string; department_id: string }[] }>(
      await list(),
    ),
    fromRoute<{ rows: { id: string; name: string }[] }>(await depts()),
  ]);
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Master jabatan</h1>
      <PositionsManager rows={rows} departments={d.rows} />
    </div>
  );
}
