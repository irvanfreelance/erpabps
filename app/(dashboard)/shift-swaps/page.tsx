import { GET as list } from "@/app/api/shift-swap-requests/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Tukar shift — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; swap_date: string; status: string; requester_name: string; target_name: string }[] }>(
    await list(),
  );
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Tukar shift</h1>
      <SimpleCreate
        action="/api/shift-swap-requests"
        label="Ajukan tukar"
        fields={[
          { name: "targetEmployeeId", label: "ID tujuan" },
          { name: "requesterAssignmentId", label: "ID assignment pemohon" },
          { name: "swapDate", label: "Tanggal", type: "date" },
          { name: "reason", label: "Alasan" },
        ]}
      />
      <DataTable
        data={rows}
        columns={[
          { key: "swap_date", label: "Tanggal" },
          { key: "requester_name", label: "Pemohon" },
          { key: "target_name", label: "Tujuan" },
          { key: "status", label: "Status" },
        ]}
      />
    </div>
  );
}
