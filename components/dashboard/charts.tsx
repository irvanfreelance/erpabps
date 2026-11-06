"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtRp } from "@/lib/utils/format";

const PALETTE = [
  "#01665a",
  "#3498db",
  "#f39c12",
  "#e74c3c",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#2c3e50",
  "#27ae60",
  "#e91e63",
];

const RFM: Record<string, string> = {
  champions: "#01665a",
  loyal: "#27ae60",
  potential: "#3498db",
  at_risk: "#e67e22",
  lost: "#95a5a6",
  new: "#9b59b6",
  one_time: "#f39c12",
  unscored: "#bdc3c7",
};

const STATUS: Record<string, string> = {
  aktif: "#27ae60",
  mati: "#95a5a6",
  diblokir: "#e74c3c",
  opt_out: "#2c3e50",
};

const FOLLOW: Record<string, string> = {
  in_progress: "#3498db",
  waiting_callback: "#f39c12",
  closing: "#27ae60",
  failed: "#e74c3c",
  belum: "#95a5a6",
};

function colorAt(i: number) {
  return PALETTE[i % PALETTE.length];
}

const axis = { fontSize: 10 };
const moneyTick = (v: number) => (v >= 1e6 ? `${v / 1e6}jt` : v >= 1e3 ? `${v / 1e3}rb` : String(v));

function DonationTrend({ data }: { data: { bulan: string; total: number; n: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="bulan" tick={axis} />
        <YAxis yAxisId="rp" tick={axis} tickFormatter={moneyTick} />
        <YAxis yAxisId="n" orientation="right" tick={axis} allowDecimals={false} />
        <Tooltip
          formatter={(v, name) => (name === "Nominal" ? fmtRp(Number(v)) : `${v} trx`)}
        />
        <Legend />
        <Area yAxisId="rp" type="monotone" dataKey="total" name="Nominal" fill="#3498db33" stroke="#3498db" strokeWidth={2} />
        <Line yAxisId="n" type="monotone" dataKey="n" name="Jumlah trx" stroke="#e67e22" strokeWidth={2} dot={{ r: 3, fill: "#e67e22" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function RfmPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={78} paddingAngle={2} label={({ name, value }) => `${name} (${value})`}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={RFM[d.name] ?? colorAt(i)} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function WorkloadBars({ data }: { data: { nama: string; n: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis type="number" tick={axis} allowDecimals={false} />
        <YAxis dataKey="nama" type="category" width={120} tick={axis} />
        <Tooltip />
        <Bar dataKey="n" name="Assigned" radius={[0, 6, 6, 0]}>
          {data.map((d, i) => (
            <Cell key={d.nama} fill={colorAt(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProgramBars({ data }: { data: { nama: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="nama" tick={axis} interval={0} angle={-18} textAnchor="end" height={52} />
        <YAxis tick={axis} tickFormatter={moneyTick} />
        <Tooltip formatter={(v) => fmtRp(Number(v))} />
        <Bar dataKey="total" name="Donasi" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={d.nama} fill={colorAt(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={76} paddingAngle={2} label={({ name, value }) => `${name} (${value})`}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={STATUS[d.name] ?? colorAt(i + 3)} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function FollowupBars({ data }: { data: { name: string; n: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="name" tick={axis} />
        <YAxis tick={axis} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="n" name="Donatur" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={FOLLOW[d.name] ?? colorAt(i + 1)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-white p-4 shadow-sm md:p-[18px]">
      <h2 className="mb-2.5 mt-0 text-[15px] font-bold text-[var(--primary)]">{title}</h2>
      {children}
    </div>
  );
}

export default function DashboardCharts({
  trend,
  rfm,
  byProgram,
  byStatus,
  workload,
  byFollow,
}: {
  trend: { bulan: string; total: number; n: number }[];
  rfm: { name: string; value: number }[];
  byProgram: { nama: string; total: number }[];
  byStatus: { name: string; value: number }[];
  workload: { nama: string; n: number }[];
  byFollow: { name: string; n: number }[];
}) {
  return (
    <div className="mb-3.5 grid min-w-0 grid-cols-1 gap-3.5 lg:grid-cols-2">
      <ChartCard title="Tren donasi vs jumlah transaksi">
        <DonationTrend data={trend} />
      </ChartCard>
      <ChartCard title="Segmen RFM">
        <RfmPie data={rfm} />
      </ChartCard>
      <ChartCard title="Donasi per program">
        <ProgramBars data={byProgram} />
      </ChartCard>
      <ChartCard title="Status kontak">
        <StatusPie data={byStatus} />
      </ChartCard>
      <ChartCard title="Workload PIC">
        <WorkloadBars data={workload} />
      </ChartCard>
      <ChartCard title="Pipeline follow-up">
        <FollowupBars data={byFollow} />
      </ChartCard>
    </div>
  );
}
