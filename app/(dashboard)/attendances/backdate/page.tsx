import { redirect } from "next/navigation";
import { GET as listEmp } from "@/app/api/employees/route";
import { BackdateForm } from "@/components/hrd/backdate-form";
import { fromRoute } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Backdate presensi" };

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/attendances/clock");

  const { rows } = await fromRoute<{ rows: { id: string; full_name: string }[] }>(await listEmp());
  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)]">Koreksi Backdate / Lupa Presensi</h1>
        <p className="text-[13px] text-gray-500">
          Khusus Superadmin/HR. Digunakan untuk mengentri presensi karyawan yang lupa absen atau koreksi kehadiran dengan alasan tertulis dan jejak audit.
        </p>
      </div>
      <BackdateForm employees={rows.map((r) => ({ id: r.id, name: r.full_name }))} />
    </div>
  );
}
