import { GET as list } from "@/app/api/cash-advances/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Kasbon — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{
    rows: { id: string; full_name: string; amount: string; remaining_amount: string; screening_status: string; interval_unit: string }[];
  }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Pengajuan kasbon</h1>
      <SimpleCreate
        action="/api/cash-advances"
        label="Ajukan"
        fields={[
          { name: "employeeId", label: "ID karyawan (superadmin)" },
          { name: "amount", label: "Nominal", type: "money" },
          { name: "installmentCount", label: "Kali cicilan", type: "number" },
          { name: "installmentAmount", label: "Cicilan", type: "money" },
          { name: "intervalUnit", label: "weekly/monthly/custom" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "amount", label: "Nominal", money: true },
          { key: "remaining_amount", label: "Sisa", money: true },
          { key: "interval_unit", label: "Interval" },
          { key: "screening_status", label: "Screening" },
        ]}
      />
    </div>
  );
}
