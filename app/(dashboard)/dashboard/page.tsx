import { redirect } from "next/navigation";
import { Activity, Users, Clock, AlertTriangle, Wallet } from "lucide-react";
import { GET as dashboardStats } from "@/app/api/dashboard/route";
import { fromRoute } from "@/lib/api/from-route";
import { HrdCharts } from "@/components/hrd/hrd-charts";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Dasbor" };

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Hanya superadmin yang memiliki akses ke dasbor
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) {
    redirect("/attendances/clock");
  }

  const stats = await fromRoute<{
    roster: { active: number; draft: number; in_payroll: number; total: number };
    attendancesToday: { present: number; late: number };
    openRuns: number;
    pendingKasbon: number;
    charts: {
      positionDist: Array<{ label: string; count: number }>;
      attendanceTrend: Array<{ date_label: string; hadir: number; telat: number }>;
      payGroupDist: Array<{ label: string; count: number }>;
      lastRuns: Array<{ period_name: string; date_label: string; total_gaji: number }>;
    };
  }>(await dashboardStats());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Activity size={22} className="text-[var(--primary)]" />
          <h1 className="m-0 text-[20px] font-bold text-[var(--primary)] md:text-[24px]">Dasbor HRD & Operasional</h1>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Ringkasan kehadiran hari ini, status kepegawaian, pengajuan kasbon, dan histori penggajian
        </p>
      </div>

      {/* 4 Kartu KPI Utama */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Karyawan Aktif</span>
            <Users size={16} className="text-[var(--primary)]" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.roster?.active ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            {stats.roster?.draft ?? 0} Draf · {stats.roster?.in_payroll ?? 0} Masuk Payroll
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Kehadiran Hari Ini</span>
            <Clock size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats.attendancesToday?.present ?? 0}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            {stats.attendancesToday?.late ?? 0} Karyawan Terlambat
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Kasbon Menunggu</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{stats.pendingKasbon ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Menunggu screening atasan</div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Run Payroll Terbuka</span>
            <Wallet size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{stats.openRuns ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Draf / Siap dibayarkan</div>
        </div>
      </div>

      {/* Visualisasi Grafik Komprehensif */}
      {stats.charts && <HrdCharts data={stats.charts} />}
    </div>
  );
}
