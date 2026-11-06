import { Activity, AlertTriangle, TrendingUp, Users, Wallet } from "lucide-react";
import DashboardCharts from "@/components/dashboard/charts";
import { GET as dashboardStats } from "@/app/api/dashboard/route";
import { fromRoute } from "@/lib/api/from-route";
import { fmtRp, toNum } from "@/lib/utils/format";

export const metadata = { title: "Dashboard — CRM RN", description: "Ringkasan CRM" };

export default async function DashboardPage() {
  const stats = await fromRoute<{
    totals: Record<string, number | string>;
    rfm: Array<{ segmen: string; n: number }>;
    trend: Array<{ bulan: string; total: string | number; n: number }>;
    workload: Array<{ nama: string; n: number }>;
    byProgram: Array<{ nama: string; total: string | number }>;
    byStatus: Array<{ name: string; value: number }>;
    byFollow: Array<{ name: string; n: number }>;
  }>(await dashboardStats());
  const totals = stats.totals;
  const rfm = (stats.rfm as Array<{ segmen: string; n: number }>).map((r) => ({ name: r.segmen, value: r.n }));
  const trend = (stats.trend as Array<{ bulan: string; total: string | number; n: number }>)
    .slice()
    .reverse()
    .map((r) => ({ bulan: String(r.bulan).slice(2), total: toNum(r.total), n: Number(r.n) }));
  const workload = (stats.workload as Array<{ nama: string; n: number }>).map((r) => ({ nama: r.nama, n: r.n }));
  const byProgram = (stats.byProgram as Array<{ nama: string; total: string | number }>).map((r) => ({
    nama: r.nama,
    total: toNum(r.total),
  }));
  const byStatus = stats.byStatus as Array<{ name: string; value: number }>;
  const byFollow = stats.byFollow as Array<{ name: string; n: number }>;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Activity size={20} color="var(--primary)" />
        <h1 className="m-0 text-[20px] font-bold text-[var(--primary)]">Dashboard CRM</h1>
      </div>
      <p className="mb-4 text-[13px] text-[#666]">Ringkasan operasional lembaga</p>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Donatur Aktif" value={String(totals.aktif ?? 0)} color="#01665a" icon={<Users size={16} />} />
        <Stat label="Total Donasi" value={fmtRp(toNum(totals.lifetime))} color="#2e8b7a" icon={<Wallet size={16} />} />
        <Stat label="Semua Donatur" value={String(totals.donors ?? 0)} color="#3498db" icon={<TrendingUp size={16} />} />
        <Stat label="Assigned" value={String(totals.assigned ?? 0)} color="#e74c3c" icon={<AlertTriangle size={16} />} />
      </div>
      <DashboardCharts
        trend={trend}
        rfm={rfm}
        byProgram={byProgram}
        byStatus={byStatus}
        workload={workload}
        byFollow={byFollow}
      />
    </div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[10px] bg-white p-3.5 text-center shadow-sm" style={{ borderTop: `3px solid ${color}` }}>
      <div className="mb-1 flex items-center justify-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] font-semibold text-[#888]">{label}</span>
      </div>
      <div className="text-[20px] font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

