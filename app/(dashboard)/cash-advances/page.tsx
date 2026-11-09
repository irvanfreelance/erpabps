import { GET as list } from "@/app/api/cash-advances/route";
import { CashAdvancesManager, type CashAdvanceRow } from "@/components/hrd/cash-advances-manager";
import { fromRoute } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Pengajuan Kasbon" };

export default async function Page() {
  const session = await getServerSession();
  const { rows } = await fromRoute<{ rows: CashAdvanceRow[]; userRole: string }>(await list());
  const canScreen = session?.user.role === "superadmin";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)]">Pengajuan & Pengelolaan Kasbon</h1>
        <p className="text-[13px] text-gray-500">
          Baik atasan maupun bawahan mengajukan kasbon ke Superadmin HR. Kasbon yang disetujui akan otomatis memotong payroll bulanan dan dapat dioverride nominal potongannya saat gajian.
        </p>
      </div>

      <CashAdvancesManager
        rows={rows}
        userRole={session?.user.role || "subordinat"}
        canScreen={canScreen}
      />
    </div>
  );
}
