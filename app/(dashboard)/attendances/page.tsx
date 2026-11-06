import { GET as list } from "@/app/api/attendances/route";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Rekap presensi — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{
    rows: { id: string; full_name: string; attendance_date: string; clock_in_at: string | null; late_minutes: number; clock_in_status: string }[];
  }>(await list(internalRequest("/api/attendances")));
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Rekap presensi</h1>
      <DataTable
        data={rows}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "attendance_date", label: "Tanggal" },
          { key: "clock_in_at", label: "Masuk" },
          { key: "late_minutes", label: "Telat", numeric: true },
          { key: "clock_in_status", label: "Status" },
        ]}
      />
    </div>
  );
}
