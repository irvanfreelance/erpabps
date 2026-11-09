import { GET as list } from "@/app/api/approval-requests/route";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Kotak persetujuan" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; target_type: string; status: string; requested_by_name: string }[] }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Kotak persetujuan</h1>
      <DataTable
        data={rows}
        columns={[
          { key: "target_type", label: "Target" },
          { key: "requested_by_name", label: "Pemohon" },
          { key: "status", label: "Status" },
        ]}
      />
    </div>
  );
}
