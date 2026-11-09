"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { fmtRp } from "@/lib/utils/format";

const PIE_COLORS = ["#01665a", "#2e8b7a", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b"];

interface HrdChartsData {
  positionDist: Array<{ label: string; count: number }>;
  attendanceTrend: Array<{ date_label: string; hadir: number; telat: number }>;
  payGroupDist: Array<{ label: string; count: number }>;
  lastRuns: Array<{ period_name: string; date_label: string; total_gaji: number }>;
}

export function HrdCharts({ data }: { data: HrdChartsData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
      {/* 1. Tren Kehadiran 7 Hari */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-900">Tren Kehadiran (7 Hari Terakhir)</h3>
          <p className="text-xs text-gray-500">Perbandingan presensi hadir tepat waktu vs terlambat</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#01665a" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#01665a" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorTelat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date_label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Area type="monotone" dataKey="hadir" name="Hadir" stroke="#01665a" fillOpacity={1} fill="url(#colorHadir)" strokeWidth={2} />
              <Area type="monotone" dataKey="telat" name="Terlambat" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTelat)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Distribusi Karyawan per Jabatan */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-900">Distribusi Karyawan per Jabatan</h3>
          <p className="text-xs text-gray-500">Komposisi jumlah personil tiap jabatan</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.positionDist} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Bar dataKey="count" name="Jumlah Karyawan" fill="#2e8b7a" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Komposisi Kelompok Gaji */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-900">Komposisi Kelompok Gaji</h3>
          <p className="text-xs text-gray-500">Proporsi karyawan berdasarkan kelompok payroll</p>
        </div>
        <div className="h-64 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.payGroupDist}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
              >
                {data.payGroupDist.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Historis Pengeluaran Payroll Run */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-900">Pengeluaran Payroll Terakhir</h3>
          <p className="text-xs text-gray-500">Total nominal gaji bersih yang telah diproses per periode</p>
        </div>
        <div className="h-64 w-full">
          {data.lastRuns && data.lastRuns.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.lastRuns} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="period_name" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `Rp${(val / 1000000).toFixed(0)}jt`}
                  width={60}
                />
                <Tooltip
                  formatter={(val) => [fmtRp(val as number), "Total Payroll"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Bar dataKey="total_gaji" name="Gaji Bersih" fill="#01665a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              Belum ada riwayat run payroll yang tercatat
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

