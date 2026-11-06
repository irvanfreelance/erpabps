import { GET as list } from "@/app/api/contract-stage-options/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Katalog tahap — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; code: string; name: string; duration_months: number }[] }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Katalog tahap kontrak</h1>
      <SimpleCreate
        action="/api/contract-stage-options"
        label="Tambah tahap"
        fields={[
          { name: "code", label: "Kode" },
          { name: "name", label: "Nama" },
          { name: "durationMonths", label: "Bulan", type: "number" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "duration_months", label: "Bulan", numeric: true },
        ]}
      />
    </div>
  );
}
