import { GET as getRun } from "@/app/api/payroll-runs/[id]/route";
import { RunActions } from "@/components/hrd/run-actions";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Detail run — ABPS" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fromRoute<{
    run: { id: string; status: string; period_start: string; period_end: string; pay_group_name: string };
    items: { id: string; full_name: string; payable_minutes: number; late_minutes: number; net_pay: string }[];
  }>(await getRun(internalRequest(`/api/payroll-runs/${id}`), { params: Promise.resolve({ id }) }));
  return (
    <div>
      <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)]">{data.run.pay_group_name}</h1>
      <p className="mb-3 text-[13px] text-[#666]">
        {data.run.period_start} — {data.run.period_end} · {data.run.status}
      </p>
      <RunActions id={id} status={data.run.status} />
      <DataTable
        data={data.items}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "payable_minutes", label: "Menit", numeric: true },
          { key: "late_minutes", label: "Telat", numeric: true },
          { key: "net_pay", label: "Netto", money: true },
        ]}
      />
    </div>
  );
}
