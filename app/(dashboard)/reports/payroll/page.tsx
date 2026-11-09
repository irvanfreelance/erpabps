import { GET as list } from "@/app/api/reports/payroll/route";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Laporan payroll" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { full_name: string; period_end: string; status: string; net_pay: string }[] }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Laporan payroll</h1>
      <DataTable
        data={rows as { id?: string }[]}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "period_end", label: "Periode" },
          { key: "status", label: "Status" },
          { key: "net_pay", label: "Netto", money: true },
        ]}
      />
    </div>
  );
}
