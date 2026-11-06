import { GET as list } from "@/app/api/holidays/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Hari libur — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; holiday_date: string; name: string }[] }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Hari libur</h1>
      <SimpleCreate
        action="/api/holidays"
        label="Tambah"
        fields={[
          { name: "holidayDate", label: "Tanggal", type: "date" },
          { name: "name", label: "Nama" },
        ]}
      />
      <DataTable data={rows} columns={[{ key: "holiday_date", label: "Tanggal" }, { key: "name", label: "Nama" }]} />
    </div>
  );
}
