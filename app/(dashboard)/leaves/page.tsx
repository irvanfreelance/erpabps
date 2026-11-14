import { GET as list } from "@/app/api/leave-requests/route";
import { LeavesManager, type LeaveRow } from "@/components/hrd/leaves-manager";
import { fromRoute } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Pengajuan Cuti & Izin" };

export default async function Page() {
  const session = await getServerSession();
  const { rows } = await fromRoute<{ rows: LeaveRow[]; userRole: string }>(await list());
  const canApprove = session?.user.role === "superadmin" || session?.user.role === "superordinat";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)]">Pengajuan & Persetujuan Cuti</h1>
        <p className="text-[13px] text-gray-500">
          Karyawan dapat mengajukan cuti, izin, atau sakit. Atasan dan Admin dapat memberikan persetujuan (langsung memperbarui jadwal menjadi libur/izin) atau menolak.
        </p>
      </div>

      <LeavesManager
        rows={rows}
        userRole={session?.user.role || "subordinat"}
        canApprove={canApprove}
        currentEmployeeId={session?.user.employeeId ?? null}
      />
    </div>
  );
}
