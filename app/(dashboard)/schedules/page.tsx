import { GET as list } from "@/app/api/shift-assignments/route";
import { GET as listEmp } from "@/app/api/employees/route";
import { GET as listTpl } from "@/app/api/shift-templates/route";
import { SimpleCreate } from "@/components/hrd/simple-create";
import { DataTable } from "@/components/data-table/data-table";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Kalender jadwal — ABPS" };

export default async function Page() {
  const [{ rows }, emp, tpl] = await Promise.all([
    fromRoute<{ rows: Record<string, unknown>[] }>(await list(internalRequest("/api/shift-assignments"))),
    fromRoute<{ rows: { id: string; full_name: string }[] }>(await listEmp()),
    fromRoute<{ rows: { id: string; code: string }[] }>(await listTpl()),
  ]);
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Kalender jadwal</h1>
      <p className="mb-2 text-[12px] text-[#888]">
        Karyawan: {emp.rows.map((e) => `${e.id}:${e.full_name}`).join(" · ")} · Shift:{" "}
        {tpl.rows.map((t) => `${t.id}:${t.code}`).join(" · ")}
      </p>
      <SimpleCreate
        action="/api/shift-assignments"
        label="Pasang shift"
        fields={[
          { name: "employeeId", label: "ID karyawan" },
          { name: "shiftTemplateId", label: "ID template" },
          { name: "workDate", label: "Tanggal", type: "date" },
          { name: "stationCode", label: "Station" },
        ]}
      />
      <DataTable
        data={rows as { id: string }[]}
        columns={[
          { key: "work_date", label: "Tanggal" },
          { key: "full_name", label: "Nama" },
          { key: "shift_code", label: "Shift" },
          { key: "station_code", label: "Station" },
          { key: "shift_kind", label: "Jenis" },
        ]}
      />
    </div>
  );
}
