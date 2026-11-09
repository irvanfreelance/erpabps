import { GET as list } from "@/app/api/attendances/route";
import { GET as listLocations } from "@/app/api/locations/route";
import { GET as listEmployeeTypes } from "@/app/api/employee-types/route";
import { AttendancesTable, type AttendanceItem } from "@/components/hrd/attendances-table";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Daftar Kehadiran Karyawan — ABPS" };

export default async function Page() {
  const [{ rows }, locs, types] = await Promise.all([
    fromRoute<{ rows: AttendanceItem[] }>(await list(internalRequest("/api/attendances"))),
    fromRoute<{ rows: { id: string; name: string }[] }>(await listLocations()).catch(() => ({ rows: [] })),
    fromRoute<{ rows: { code: string; name: string }[] }>(await listEmployeeTypes()).catch(() => ({ rows: [] })),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)]">
          Daftar Kehadiran Karyawan
        </h1>
        <p className="text-[13px] text-gray-500">
          Rekap presensi aktual harian, status radius lokasi, keterlambatan, dan pencatatan alasan.
        </p>
      </div>

      <AttendancesTable
        initialRows={rows}
        locations={locs.rows}
        employeeTypes={types.rows}
      />
    </div>
  );
}
