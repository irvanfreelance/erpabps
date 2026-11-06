import { GET as list } from "@/app/api/pay-groups/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Kelompok gaji — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; code: string; name: string; pay_frequency: string; payday_day: number | null }[] }>(
    await list(),
  );
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Kelompok gaji</h1>
      <SimpleCreate
        action="/api/pay-groups"
        label="Tambah"
        fields={[
          { name: "code", label: "Kode" },
          { name: "name", label: "Nama" },
          { name: "payFrequency", label: "weekly/monthly" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "pay_frequency", label: "Frekuensi" },
          { key: "payday_day", label: "Payday" },
        ]}
      />
    </div>
  );
}
