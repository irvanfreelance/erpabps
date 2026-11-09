import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await guardStockApi();
  if (errorResponse) return errorResponse;

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
      vb.due_date,
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
    FROM sales_invoices
  `;
  const totalCogs = Number(totalCogsRes[0]?.total_cogs ?? 0);

  // 7. Total Belanja Masuk (All-in)
  const totalPurchasesRes = await sql`
    SELECT COALESCE(SUM(all_in_value), 0)::numeric as total_purchases
    FROM goods_receipt_lines
  `;
  const totalPurchases = Number(totalPurchasesRes[0]?.total_purchases ?? 0);

  return NextResponse.json({
    data: {
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
    },
  });
}

