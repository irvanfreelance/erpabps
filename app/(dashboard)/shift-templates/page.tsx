import { GET as list } from "@/app/api/shift-templates/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Template shift" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; code: string; name: string; shift_kind: string; start_time: string; end_time: string }[] }>(
    await list(),
  );
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Template shift</h1>
      <SimpleCreate
        action="/api/shift-templates"
        label="Tambah template"
        fields={[
          { name: "code", label: "Kode" },
          { name: "name", label: "Nama" },
          { name: "shiftKind", label: "Jenis regular/backup" },
          { name: "startTime", label: "Mulai", type: "time" },
          { name: "endTime", label: "Selesai", type: "time" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "shift_kind", label: "Jenis" },
          { key: "start_time", label: "Mulai" },
          { key: "end_time", label: "Selesai" },
        ]}
      />
    </div>
  );
}
