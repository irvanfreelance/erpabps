import { GET as list } from "@/app/api/salary-components/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Komponen gaji" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; code: string; name: string; component_type: string }[] }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Komponen</h1>
      <SimpleCreate
        action="/api/salary-components"
        label="Tambah"
        fields={[
          { name: "code", label: "Kode" },
          { name: "name", label: "Nama" },
          { name: "componentType", label: "Tipe" },
        ]}
      />
      <DataTable data={rows} columns={[{ key: "code", label: "Kode" }, { key: "name", label: "Nama" }, { key: "component_type", label: "Tipe" }]} />
    </div>
  );
}
