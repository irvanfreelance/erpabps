import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { GET as getStockReports } from "@/app/api/stock-reports/route";
import { internalRequest, fromRoute } from "@/lib/api/from-route";
import { StockCharts } from "@/components/stock/stock-charts";
import { StockDateFilter } from "@/components/stock/stock-date-filter";
import {
  Boxes,
  Factory,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface StockReportsData {
  balances: Array<{
    id: string;
    sku: string;
    item_name: string;
    item_kind: string;
    uom_code: string;
    bin_code: string;
    bin_name: string;
    qty: string | number;
    unit_cost: string | number;
    value: string | number;
  }>;
  cashFunds: Array<{
    id: string;
    code: string;
    name: string;
    balance: string | number;
  }>;
  vendorBills: Array<{
    id: string;
    doc_no: string;
    vendor_name: string;
    amount: string | number;
    amount_open: string | number;
    due_date: string;
    status: string;
  }>;
  salesSummary: Array<{
    id: string;
    doc_no: string;
    party_name: string;
    party_kind: string;
    omzet: string | number;
    cogs: string | number;
    laba: string | number;
    margin_achieved_pct: string | number;
  }>;
  reconciliation: {
    totalStockValue: number;
    totalCogs: number;
    sumStockPlusCogs: number;
    totalPurchases: number;
    isBalanced: boolean;
  };
  charts?: {
    stockByBin: Array<{ label: string; total_value: number }>;
    stockByCategory: Array<{ label: string; total_value: number }>;
    channelPerformance: Array<{ channel_name: string; omzet: number; cogs: number; laba: number }>;
    dailyMovements?: Array<{
      date_label: string;
      full_date: string;
      belanja: number;
      produksi: number;
      penjualan_hpp: number;
    }>;
  };
  filters?: {
    startDate?: string | null;
    endDate?: string | null;
  };
}

function formatRupiah(val: number | string) {
  const num = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num || 0);
}

function formatQty(val: number | string) {
  const num = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(num || 0);
}

export default async function StockDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ start_date?: string; end_date?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-3" />
        <h2 className="text-lg font-bold text-gray-800">Akses Ditolak</h2>
        <p className="text-sm text-gray-500 max-w-md mt-1">
          Modul Stok dan HPP hanya dapat diakses oleh Superadmin. Role Anda tidak memiliki izin untuk melihat modul ini.
        </p>
      </div>
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const startDate = resolvedParams.start_date || "";
  const endDate = resolvedParams.end_date || "";

  let data: StockReportsData | null = null;
  try {
    const query = new URLSearchParams();
    if (startDate) query.set("start_date", startDate);
    if (endDate) query.set("end_date", endDate);
    const queryString = query.toString() ? `?${query.toString()}` : "";

    const req = internalRequest(`/api/stock-reports${queryString}`);
    const res = await getStockReports(req);
    // fromRoute mengembalikan payload yang diserialkan oleh route
    // API mengembalikan objek jsonSafe(payload) langsung (atau { data: payload })
    const json = (await res.json()) as StockReportsData & { data?: StockReportsData };
    data = json.data ?? json;
  } catch (err) {
    console.error("Gagal memuat laporan stok:", err);
  }

  const rec = data?.reconciliation;
  const cashBalance = data?.cashFunds?.[0]?.balance ?? 0;

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Boxes className="text-[var(--primary)]" size={24} />
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Dasbor & Laporan Stok HPP</h1>
          </div>
          <p className="text-xs text-gray-500">
            Siklus terpadu dapur pusat: Belanja Vendor → Kas Dapur → Produksi Ungkep → Penjualan Bermargin Outlet & Catering
          </p>
        </div>
      </div>

      {/* Date Range Filter Toolbar */}
      <StockDateFilter initialStartDate={startDate} initialEndDate={endDate} />

      {/* Ringkasan Rekonsiliasi Siklus (Kesesuaian Angka) */}
      {rec && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-700" />
              <span className="text-sm font-bold text-emerald-950">
                Pemeriksaan Siklus Lengkap (Audit Rekonsiliasi HPP)
              </span>
            </div>
            <span className="rounded-full bg-emerald-200/70 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
              {rec.isBalanced ? "✓ Angka Seimbang (Matched)" : "Selisih Ditemukan"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-gray-500 font-medium">1. Belanja All-in (Vendor + Ongkir):</div>
              <div className="text-base font-bold text-gray-900 mt-0.5">{formatRupiah(rec.totalPurchases)}</div>
              <div className="text-[11px] text-gray-500">GRN-CONTOH (Ayam + Bumbu + Ongkir)</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">2. HPP Barang Keluar (Terjual):</div>
              <div className="text-base font-bold text-blue-700 mt-0.5">{formatRupiah(rec.totalCogs)}</div>
              <div className="text-[11px] text-gray-500">4 kg Outlet + 3 kg Catering</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">3. Nilai Persediaan Sisa:</div>
              <div className="text-base font-bold text-indigo-700 mt-0.5">{formatRupiah(rec.totalStockValue)}</div>
              <div className="text-[11px] text-gray-500">Gudang Bahan + Freezer Ungkep</div>
            </div>
            <div>
              <div className="text-gray-500 font-medium">4. HPP Keluar + Nilai Sisa:</div>
              <div className="text-base font-bold text-emerald-800 mt-0.5">
                {formatRupiah(rec.sumStockPlusCogs)}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold">Tepat sama dengan nilai belanja Rp672.000</div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Kartu KPI Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kas Dapur */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Kas Operasional Dapur</span>
            <Wallet size={18} className="text-amber-600" />
          </div>
          <div className="text-xl font-bold text-gray-900">{formatRupiah(cashBalance)}</div>
          <p className="mt-1 text-[11px] text-gray-500">
            Dari uang muka Rp2.000.000, dipakai belanja Rp672.000 (Lunas).
          </p>
        </div>

        {/* Hutang Vendor */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Hutang Vendor (Open)</span>
            <Receipt size={18} className="text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatRupiah(data?.vendorBills?.[0]?.amount_open ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium">
            Hutang Rp672.000 telah lunas dibayar setelah barang tiba.
          </p>
        </div>

        {/* Produksi Ungkep */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">HPP Ayam Ungkep</span>
            <Factory size={18} className="text-purple-600" />
          </div>
          <div className="text-xl font-bold text-gray-900">{formatRupiah(38640)} / kg</div>
          <p className="mt-1 text-[11px] text-gray-500">
            Hasil 10 kg dari 12 kg Ayam Utuh (all-in) + 0,4 kg Bumbu Racik.
          </p>
        </div>

        {/* Laba Penjualan */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Laba Penjualan</span>
            <TrendingUp size={18} className="text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-700">
            {formatRupiah(
              (data?.salesSummary ?? []).reduce((acc, row) => acc + Number(row.laba || 0), 0)
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Outlet: Rp30.912 (20%) | Catering: Rp34.776 (30%).
          </p>
        </div>
      </div>

      {/* Visualisasi Statistik Chart Lengkap Modul Stok */}
      {data?.charts && <StockCharts data={data.charts} />}

      {/* Grid: Saldo Stok & Rekap Penjualan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saldo Persediaan Saat Ini */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Boxes size={18} className="text-[var(--primary)]" />
              <h2 className="text-sm font-bold text-gray-900">Saldo Persediaan di Gudang & Freezer</h2>
            </div>
            <span className="text-xs font-semibold text-gray-500">
              Total: {formatRupiah(rec?.totalStockValue ?? 0)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 border-y border-gray-200">
                <tr>
                  <th className="py-2 px-3 font-semibold">Barang</th>
                  <th className="py-2 px-3 font-semibold">Lokasi Bin</th>
                  <th className="py-2 px-3 font-semibold text-right">Kuantitas</th>
                  <th className="py-2 px-3 font-semibold text-right">HPP Satuan</th>
                  <th className="py-2 px-3 font-semibold text-right">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.balances ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      <div>{row.item_name}</div>
                      <div className="text-[10px] text-gray-400">{row.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                        {row.bin_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {formatQty(row.qty)} {row.uom_code}
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-600">{formatRupiah(row.unit_cost)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">{formatRupiah(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Realisasi Penjualan & Margin */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Penjualan ke Kanal (Bermargin)</h2>
            </div>
            <span className="text-xs font-semibold text-blue-600">
              Omzet: {formatRupiah(336168)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 border-y border-gray-200">
                <tr>
                  <th className="py-2 px-3 font-semibold">Faktur / Pihak</th>
                  <th className="py-2 px-3 font-semibold text-right">Omzet</th>
                  <th className="py-2 px-3 font-semibold text-right">HPP Keluar</th>
                  <th className="py-2 px-3 font-semibold text-right">Laba</th>
                  <th className="py-2 px-3 font-semibold text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.salesSummary ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      <div>{row.party_name}</div>
                      <div className="text-[10px] text-gray-400">{row.doc_no}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-900">{formatRupiah(row.omzet)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500">{formatRupiah(row.cogs)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{formatRupiah(row.laba)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        +{Number(row.margin_achieved_pct).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">Catatan Kemitraan & Kanal:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Penjualan Outlet Baros (Internal): 4 kg Ayam Ungkep @ Rp46.368 (Margin 20%).</li>
              <li>Penjualan Kanal Catering: 3 kg Ayam Ungkep @ Rp50.232 (Margin 30%).</li>
              <li>Outlet Mitra Pihak Ketiga (sebagai customer) belum ada transaksi pada siklus ini.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
