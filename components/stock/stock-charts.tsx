"use client";

import { useEffect, useState } from "react";
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

const PIE_COLORS = ["#01665a", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#10b981"];

interface StockChartsData {
  stockByBin?: Array<{ label: string; total_value: number }>;
  stockByCategory?: Array<{ label: string; total_value: number }>;
  channelPerformance?: Array<{ channel_name: string; omzet: number; cogs: number; laba: number }>;
  dailyMovements?: Array<{
    date_label: string;
    full_date: string;
    belanja: number;
    produksi: number;
    penjualan_hpp: number;
  }>;
}

export function StockCharts({ data }: { data?: StockChartsData }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stockByBin = data?.stockByBin ?? [];
  const stockByCategory = data?.stockByCategory ?? [];
  const channelPerformance = data?.channelPerformance ?? [];
  const dailyMovements = data?.dailyMovements ?? [];

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Analisis Grafik Persediaan & Penjualan</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="h-72 rounded-2xl border border-gray-200 bg-white p-5 animate-pulse" />
          <div className="h-72 rounded-2xl border border-gray-200 bg-white p-5 animate-pulse" />
          <div className="h-72 rounded-2xl border border-gray-200 bg-white p-5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Analisis Grafik Persediaan & Penjualan</h2>
          <p className="text-xs text-gray-500">Visualisasi komposisi persediaan gudang, margin kanal, dan mutasi nilai</p>
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          ● Data Visual Aktif
        </span>
      </div>

      {/* Baris 1: 3 Grafik Utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Nilai Persediaan per Bin */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-gray-900">Nilai Stok per Bin Lokasi</h3>
            <p className="text-xs text-gray-500">Distribusi nilai fisik di Gudang vs Freezer</p>
          </div>
          <div className="h-64 w-full min-h-[256px]">
            {stockByBin.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={stockByBin}
                    dataKey="total_value"
                    nameKey="label"
                    cx="50%"
                    cy="45%"
                    innerRadius={46}
                    outerRadius={70}
                    paddingAngle={4}
                  >
                    {stockByBin.map((_, index) => (
                      <Cell key={`bin-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [fmtRp(Number(val) || 0), "Nilai"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                Belum ada data saldo bin
              </div>
            )}
          </div>
        </div>

        {/* 2. Komposisi Nilai per Kategori */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-gray-900">Persediaan per Kategori</h3>
            <p className="text-xs text-gray-500">Bahan Baku Mentah vs Olahan Siap Jual</p>
          </div>
          <div className="h-64 w-full min-h-[256px]">
            {stockByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={stockByCategory} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => `Rp${(Number(val) / 1000).toFixed(0)}rb`}
                    width={60}
                  />
                  <Tooltip
                    formatter={(val) => [fmtRp(Number(val) || 0), "Total Nilai"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Bar dataKey="total_value" name="Nilai Stok" fill="#01665a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                Belum ada data kategori
              </div>
            )}
          </div>
        </div>

        {/* 3. Performa Penjualan & Margin per Kanal */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="text-sm font-bold text-gray-900">Omzet, HPP & Laba per Kanal</h3>
            <p className="text-xs text-gray-500">Perbandingan margin Outlet vs Catering</p>
          </div>
          <div className="h-64 w-full min-h-[256px]">
            {channelPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={channelPerformance} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="channel_name" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => `Rp${(Number(val) / 1000).toFixed(0)}rb`}
                    width={55}
                  />
                  <Tooltip
                    formatter={(val) => [fmtRp(Number(val) || 0)]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  <Bar dataKey="omzet" name="Omzet" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cogs" name="HPP" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="laba" name="Laba" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                Belum ada data penjualan kanal
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Baris 2: Tren Nilai Mutasi / Pergerakan Barang */}
      {dailyMovements.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 shadow-xs">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-gray-900">Nilai Pergerakan Siklus (Belanja, Produksi & Penjualan)</h3>
            <p className="text-xs text-gray-500">Histori nilai transaksi barang masuk gudang, olah dapur, dan pengiriman</p>
          </div>
          <div className="h-64 w-full min-h-[256px]">
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={dailyMovements} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBelanja" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorProduksi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorShip" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#01665a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#01665a" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date_label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `Rp${(Number(val) / 1000).toFixed(0)}rb`}
                  width={65}
                />
                <Tooltip
                  formatter={(val) => [fmtRp(Number(val) || 0)]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                <Area
                  type="monotone"
                  dataKey="belanja"
                  name="Belanja Vendor"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#colorBelanja)"
                />
                <Area
                  type="monotone"
                  dataKey="produksi"
                  name="Produksi Dapur"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorProduksi)"
                />
                <Area
                  type="monotone"
                  dataKey="penjualan_hpp"
                  name="HPP Keluar (Terjual)"
                  stroke="#01665a"
                  fillOpacity={1}
                  fill="url(#colorShip)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
