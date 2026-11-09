import { GET as list } from "@/app/api/reports/attendance/route";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Laporan kehadiran" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { full_name: string; days: number; late_minutes: number }[] }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Laporan kehadiran</h1>
      <DataTable
        data={rows as { id?: string }[]}
        columns={[
          { key: "full_name", label: "Nama" },
          { key: "days", label: "Hari", numeric: true },
          { key: "late_minutes", label: "Telat", numeric: true },
        ]}
      />
    </div>
  );
}
