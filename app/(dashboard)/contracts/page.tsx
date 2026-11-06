import { GET as list } from "@/app/api/employment-contracts/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Kontrak orang — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; full_name: string; stage_name: string; start_date: string; end_date: string; status: string }[] }>(
    await list(),
  );
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Kontrak orang</h1>
      <SimpleCreate
        action="/api/employment-contracts"
        label="Buat kontrak"
        fields={[
          { name: "employeeId", label: "ID karyawan" },
          { name: "stageOptionId", label: "ID tahap" },
          { name: "sequenceNo", label: "Urutan", type: "number" },
          { name: "startDate", label: "Mulai", type: "date" },
          { name: "endDate", label: "Akhir", type: "date" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "stage_name", label: "Tahap" },
          { key: "start_date", label: "Mulai" },
          { key: "end_date", label: "Akhir" },
          { key: "status", label: "Status" },
        ]}
      />
    </div>
  );
}
