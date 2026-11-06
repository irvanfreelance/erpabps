import { GET as list } from "@/app/api/payroll-items/route";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Slip — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{
    rows: { id: string; full_name: string; period_start: string; period_end: string; net_pay: string; late_minutes: number }[];
  }>(await list(internalRequest("/api/payroll-items")));
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Slip</h1>
      <DataTable
        data={rows}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "period_start", label: "Mulai" },
          { key: "period_end", label: "Akhir" },
          { key: "late_minutes", label: "Telat", numeric: true },
          { key: "net_pay", label: "Netto", money: true },
        ]}
      />
    </div>
  );
}
