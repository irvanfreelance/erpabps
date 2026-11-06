import { GET as list } from "@/app/api/bonus-pools/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Bonus bulanan — ABPS" };

export default async function Page() {
  const { rows, allocations } = await fromRoute<{
    rows: { id: string; pool_kind: string; period_end: string; pool_amount: string; status: string }[];
    allocations: { full_name: string; amount: string; component_code: string }[];
  }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Bonus bulanan</h1>
      <SimpleCreate
        action="/api/bonus-pools"
        label="Buat pool"
        fields={[
          { name: "poolKind", label: "monthly_component / outlet_revenue" },
          { name: "periodStart", label: "Mulai", type: "date" },
          { name: "periodEnd", label: "Akhir", type: "date" },
          { name: "poolAmount", label: "Nominal pool", type: "money" },
          { name: "remainderPopulation", label: "Populasi sisa (wajib untuk bulanan)" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "pool_kind", label: "Jenis" },
          { key: "period_end", label: "Periode" },
          { key: "pool_amount", label: "Pool", money: true },
          { key: "status", label: "Status" },
        ]}
      />
      <h2 className="mt-6 text-[16px] font-bold">Alokasi</h2>
      <DataTable
        data={allocations as { id?: string }[]}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "component_code", label: "Komponen" },
          { key: "amount", label: "Nominal", money: true },
        ]}
      />
    </div>
  );
}
