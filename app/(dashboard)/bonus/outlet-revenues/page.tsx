import { GET as list } from "@/app/api/outlet-revenues/route";
import { GET as locs } from "@/app/api/locations/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Omset outlet — ABPS" };

export default async function Page() {
  const [{ rows }, l] = await Promise.all([
    fromRoute<{ rows: { id: string; location_name: string; period_end: string; net_amount: string }[] }>(await list()),
    fromRoute<{ rows: { id: string; name: string }[] }>(await locs()),
  ]);
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Omset outlet</h1>
      <p className="mb-2 text-[12px] text-[#888]">{l.rows.map((r) => `${r.id}:${r.name}`).join(" · ")}</p>
      <SimpleCreate
        action="/api/outlet-revenues"
        label="Input omset"
        fields={[
          { name: "locationId", label: "ID lokasi" },
          { name: "periodStart", label: "Mulai", type: "date" },
          { name: "periodEnd", label: "Akhir", type: "date" },
          { name: "grossAmount", label: "Omset kotor", type: "money" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "location_name", label: "Lokasi" },
          { key: "period_end", label: "Periode" },
          { key: "net_amount", label: "Netto", money: true },
        ]}
      />
    </div>
  );
}
