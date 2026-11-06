import { Activity } from "lucide-react";
import { GET as dashboardStats } from "@/app/api/dashboard/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Dasbor — ABPS", description: "Ringkasan HRD" };

export default async function DashboardPage() {
  const stats = await fromRoute<{
    roster: { active: number; draft: number; in_payroll: number };
    attendancesToday: number;
    openRuns: number;
    pendingKasbon: number;
  }>(await dashboardStats());

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Activity size={20} color="var(--primary)" />
        <h1 className="m-0 text-[20px] font-bold text-[var(--primary)]">Dasbor HRD</h1>
      </div>
      <p className="mb-4 text-[13px] text-[#666]">Ringkasan absensi dan payroll</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Karyawan aktif" value={String(stats.roster.active)} />
        <Stat label="Draf roster" value={String(stats.roster.draft)} />
        <Stat label="Presensi hari ini" value={String(stats.attendancesToday)} />
        <Stat label="Kasbon menunggu" value={String(stats.pendingKasbon)} />
      </div>
      <p className="mt-4 text-[13px] text-[#666]">Run payroll terbuka: {stats.openRuns}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-white p-3.5 text-center shadow-sm" style={{ borderTop: "3px solid var(--primary)" }}>
      <div className="text-[11px] font-semibold text-[#888]">{label}</div>
      <div className="text-[20px] font-bold text-[var(--primary)]">{value}</div>
    </div>
  );
}
