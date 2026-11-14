import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";
import { jsonSafe } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  const { errorResponse } = await guardStockApi();
  if (errorResponse) return errorResponse;

  let startDate = "";
  let endDate = "";

  if (request) {
    try {
      const { searchParams } = new URL(request.url);
      startDate = searchParams.get("start_date") || "";
      endDate = searchParams.get("end_date") || "";
    } catch {
      // request might be synthetic
    }
  }

  const sql = getDb();

  // 1. Saldo Stok per Barang & Bin
  const balances = await sql`
    SELECT 
      sb.id,
      si.sku,
      si.name as item_name,
      si.item_kind,
      su.code as uom_code,
      bin.code as bin_code,
      bin.name as bin_name,
      sb.qty::numeric,
      sb.unit_cost::numeric,
      sb.value::numeric
    FROM stock_balances sb
    JOIN stock_items si ON sb.item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    JOIN stock_bins bin ON sb.bin_id = bin.id
    ORDER BY bin.code, si.sku
  `;

  // 2. Ringkasan Kas Dapur
  const cashFunds = await sql`
    SELECT 
      cf.id,
      cf.code,
      cf.name,
      cf.balance::numeric
    FROM cash_funds cf
  `;

  // 3. Ringkasan Hutang Vendor
  const vendorBills = await sql`
    SELECT 
      vb.id,
      vb.doc_no,
      sp.name as vendor_name,
      vb.amount::numeric,
      vb.amount_open::numeric,
      to_char(vb.due_date, 'YYYY-MM-DD') as due_date,
      vb.status
    FROM vendor_bills vb
    JOIN stock_parties sp ON vb.vendor_id = sp.id
    ORDER BY vb.id DESC
  `;

  // 4. Ringkasan Penjualan & Margin per Pihak (Outlet & Catering)
  const salesSummary = await sql`
    SELECT 
      si.id,
      si.doc_no,
      sp.name as party_name,
      sp.party_kind,
      si.amount::numeric as omzet,
      si.cogs_amount::numeric as cogs,
      (si.amount - si.cogs_amount)::numeric as laba,
      ROUND(((si.amount - si.cogs_amount) / NULLIF(si.cogs_amount, 0) * 100), 2)::numeric as margin_achieved_pct
    FROM sales_invoices si
    JOIN stock_parties sp ON si.party_id = sp.id
    WHERE (${startDate || null}::date IS NULL OR si.created_at >= ${startDate || null}::timestamptz)
      AND (${endDate || null}::date IS NULL OR si.created_at < (${endDate || null}::date + INTERVAL '1 day')::timestamptz)
    ORDER BY si.id DESC
  `;

  // 5. Total Nilai Persediaan Akhir
  const totalStockValueRes = await sql`
    SELECT COALESCE(SUM(value), 0)::numeric as total_stock_value
    FROM stock_balances
  `;
  const totalStockValue = Number(totalStockValueRes[0]?.total_stock_value ?? 0);

  // 6. Total HPP Keluar
  const totalCogsRes = await sql`
    SELECT COALESCE(SUM(cogs_amount), 0)::numeric as total_cogs
    FROM sales_invoices si
    WHERE (${startDate || null}::date IS NULL OR si.created_at >= ${startDate || null}::timestamptz)
      AND (${endDate || null}::date IS NULL OR si.created_at < (${endDate || null}::date + INTERVAL '1 day')::timestamptz)
  `;
  const totalCogs = Number(totalCogsRes[0]?.total_cogs ?? 0);

  // 7. Total Belanja Masuk (All-in)
  const totalPurchasesRes = await sql`
    SELECT COALESCE(SUM(grl.all_in_value), 0)::numeric as total_purchases
    FROM goods_receipt_lines grl
    JOIN goods_receipts gr ON gr.id = grl.receipt_id
    WHERE (${startDate || null}::date IS NULL OR gr.created_at >= ${startDate || null}::timestamptz)
      AND (${endDate || null}::date IS NULL OR gr.created_at < (${endDate || null}::date + INTERVAL '1 day')::timestamptz)
  `;
  const totalPurchases = Number(totalPurchasesRes[0]?.total_purchases ?? 0);

  // 8. Visualisasi Charts Data (dikonversi ke Number agar Recharts Pie/Bar menerima number)
  const stockByBinRaw = await sql`
    SELECT 
      bin.name as label,
      COALESCE(SUM(sb.value), 0)::numeric as total_value
    FROM stock_bins bin
    LEFT JOIN stock_balances sb ON bin.id = sb.bin_id
    GROUP BY bin.id, bin.name
    ORDER BY total_value DESC
  `;
  const stockByBin = stockByBinRaw.map((b) => ({
    label: String(b.label),
    total_value: Number(b.total_value || 0),
  }));

  const stockByCategoryRaw = await sql`
    SELECT 
      c.name as label,
      COALESCE(SUM(sb.value), 0)::numeric as total_value
    FROM stock_item_categories c
    JOIN stock_items si ON c.id = si.category_id
    JOIN stock_balances sb ON si.id = sb.item_id
    GROUP BY c.id, c.name
    ORDER BY total_value DESC
  `;
  const stockByCategory = stockByCategoryRaw.map((c) => ({
    label: String(c.label),
    total_value: Number(c.total_value || 0),
  }));

  const channelPerformanceRaw = await sql`
    SELECT 
      sp.name as channel_name,
      COALESCE(SUM(si.amount), 0)::numeric as omzet,
      COALESCE(SUM(si.cogs_amount), 0)::numeric as cogs,
      COALESCE(SUM(si.amount - si.cogs_amount), 0)::numeric as laba
    FROM stock_parties sp
    LEFT JOIN sales_invoices si ON sp.id = si.party_id
    WHERE sp.party_kind IN ('internal_outlet', 'third_party_outlet', 'catering')
    GROUP BY sp.id, sp.name
    ORDER BY omzet DESC
  `;
  const channelPerformance = channelPerformanceRaw.map((ch) => ({
    channel_name: String(ch.channel_name),
    omzet: Number(ch.omzet || 0),
    cogs: Number(ch.cogs || 0),
    laba: Number(ch.laba || 0),
  }));

  // 9. Mutasi Harian / Trend Pergerakan Barang (Belanja, Produksi, HPP Keluar)
  const dailyMovementsRaw = await sql`
    SELECT 
      to_char(sm.created_at, 'DD/MM') as date_label,
      to_char(sm.created_at, 'YYYY-MM-DD') as full_date,
      COALESCE(SUM(CASE WHEN sm.move_kind = 'receipt' THEN sm.value ELSE 0 END), 0)::numeric as belanja,
      COALESCE(SUM(CASE WHEN sm.move_kind = 'produce' THEN sm.value ELSE 0 END), 0)::numeric as produksi,
      COALESCE(SUM(CASE WHEN sm.move_kind = 'ship' THEN sm.value ELSE 0 END), 0)::numeric as penjualan_hpp
    FROM stock_moves sm
    WHERE (${startDate || null}::date IS NULL OR sm.created_at >= ${startDate || null}::timestamptz)
      AND (${endDate || null}::date IS NULL OR sm.created_at <= (${endDate || null}::date + INTERVAL '1 day')::timestamptz)
    GROUP BY to_char(sm.created_at, 'YYYY-MM-DD'), to_char(sm.created_at, 'DD/MM')
    ORDER BY full_date ASC
  `;
  const dailyMovements = dailyMovementsRaw.map((dm) => ({
    date_label: String(dm.date_label),
    full_date: String(dm.full_date),
    belanja: Number(dm.belanja || 0),
    produksi: Number(dm.produksi || 0),
    penjualan_hpp: Number(dm.penjualan_hpp || 0),
  }));

  const payload = {
    balances,
    cashFunds,
    vendorBills,
    salesSummary,
    reconciliation: {
      totalStockValue,
      totalCogs,
      sumStockPlusCogs: totalStockValue + totalCogs,
      totalPurchases,
      isBalanced: Math.abs(totalStockValue + totalCogs - totalPurchases) < 0.01,
    },
    charts: {
      stockByBin,
      stockByCategory,
      channelPerformance,
      dailyMovements,
    },
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };

  return NextResponse.json(jsonSafe(payload));
}
