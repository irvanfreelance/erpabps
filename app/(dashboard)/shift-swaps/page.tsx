import { GET as list } from "@/app/api/shift-swap-requests/route";
import { GET as listEmployees } from "@/app/api/employees/route";
import { ShiftSwapsManager, type ShiftSwapRow } from "@/components/hrd/shift-swaps-manager";
import { fromRoute, internalRequest } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Tukar Shift" };

export default async function Page() {
  const session = await getServerSession();
  const [{ rows }, emp] = await Promise.all([
    fromRoute<{ rows: ShiftSwapRow[]; userRole: string }>(await list()),
    fromRoute<{ rows: { id: string; full_name: string }[] }>(await listEmployees()),
  ]);

  const canApprove = session?.user.role === "superadmin" || session?.user.role === "superordinat";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)]">Pengajuan & Persetujuan Tukar Shift</h1>
        <p className="text-[13px] text-gray-500">
          Karyawan dapat mengajukan pertukaran shift kerja dengan rekan kerja. Atasan dan Admin dapat menyetujui (langsung mengubah jadwal shift) atau menolak.
        </p>
      </div>

      <ShiftSwapsManager
        rows={rows}
        employees={emp.rows.map((r) => ({ id: r.id, name: r.full_name }))}
        userRole={session?.user.role || "subordinat"}
        canApprove={canApprove}
      />
    </div>
  );
}
