import { GET as list } from "@/app/api/holidays/route";
import { HolidaysManager, type HolidayRow } from "@/components/hrd/holidays-manager";
import { fromRoute } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Master Hari Libur — ABPS" };

export default async function Page() {
  const session = await getServerSession();
  const { rows } = await fromRoute<{ rows: HolidayRow[] }>(await list());
  const canManage = session?.user.role === "superadmin" || session?.user.role === "superordinat";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)]">Master Hari Libur & Tanggal Merah</h1>
        <p className="text-[13px] text-gray-500">
          Kalender tanggal merah rujukan insentif presensi (Rp50.000 / hari jika masuk di tanggal merah selain hari Minggu untuk karyawan bulanan).
        </p>
      </div>

      <HolidaysManager rows={rows} canManage={canManage} />
    </div>
  );
}
