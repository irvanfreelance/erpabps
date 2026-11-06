import { GET as list } from "@/app/api/payroll-runs/route";
import { GET as groups } from "@/app/api/pay-groups/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { RunsTable } from "@/components/hrd/runs-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Payroll run — ABPS" };

export default async function Page() {
  const [{ rows }, g] = await Promise.all([
    fromRoute<{ rows: { id: string; pay_group_name: string; period_start: string; period_end: string; status: string }[] }>(await list()),
    fromRoute<{ rows: { id: string; code: string; pay_frequency: string }[] }>(await groups()),
  ]);
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Payroll run</h1>
      <p className="mb-2 text-[12px] text-[#888]">{g.rows.map((r) => `${r.id}:${r.code}:${r.pay_frequency}`).join(" · ")}</p>
      <SimpleCreate
        action="/api/payroll-runs"
        label="Generate run"
        fields={[
          { name: "payGroupId", label: "ID kelompok" },
          { name: "periodStart", label: "Mulai", type: "date" },
          { name: "periodEnd", label: "Akhir", type: "date" },
          { name: "payFrequency", label: "weekly/monthly" },
        ]}
      />
      <RunsTable rows={rows} />
    </div>
  );
}
