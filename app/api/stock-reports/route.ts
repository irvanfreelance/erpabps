import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";
import { jsonSafe } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

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
      // permintaan sintetis dari server component
    }
  }
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) startDate = "";
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) endDate = "";

  const start = startDate || null;
  const end = endDate || null;
  const sql = getDb();

  const balances = end
    ? await sql`
        SELECT
          (mv.item_id::text || '-' || mv.bin_id::text) AS id,
          si.sku,
          si.name AS item_name,
          si.item_kind,
          c.name AS category_name,
          su.code AS uom_code,
          bin.code AS bin_code,
          bin.name AS bin_name,
          mv.qty,
          CASE WHEN mv.qty <> 0 THEN mv.value / mv.qty ELSE 0 END AS unit_cost,
          mv.value
        FROM (
          SELECT item_id, bin_id,
            SUM(CASE move_kind
              WHEN 'receipt' THEN qty WHEN 'produce' THEN qty
              WHEN 'consume' THEN -qty WHEN 'ship' THEN -qty
              ELSE qty END)::numeric AS qty,
            SUM(CASE move_kind
              WHEN 'receipt' THEN value WHEN 'produce' THEN value
              WHEN 'consume' THEN -value WHEN 'ship' THEN -value
              ELSE value END)::numeric AS value
          FROM stock_moves
          WHERE created_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta')
          GROUP BY item_id, bin_id
        ) mv
        JOIN stock_items si ON si.id = mv.item_id
        JOIN stock_item_categories c ON c.id = si.category_id
        JOIN stock_uoms su ON su.id = si.uom_id
        JOIN stock_bins bin ON bin.id = mv.bin_id
        WHERE abs(mv.qty) > 0.0000001 OR abs(mv.value) > 0.009
        ORDER BY bin.code, si.sku
      `
    : await sql`
        SELECT
          sb.id,
          si.sku,
          si.name AS item_name,
          si.item_kind,
          c.name AS category_name,
          su.code AS uom_code,
          bin.code AS bin_code,
          bin.name AS bin_name,
          sb.qty::numeric,
          sb.unit_cost::numeric,
          sb.value::numeric
        FROM stock_balances sb
        JOIN stock_items si ON sb.item_id = si.id
        JOIN stock_item_categories c ON c.id = si.category_id
        JOIN stock_uoms su ON su.id = si.uom_id
        JOIN stock_bins bin ON sb.bin_id = bin.id
        ORDER BY bin.code, si.sku
      `;

  const cashFunds = end
    ? await sql`
        SELECT cf.id, cf.code, cf.name,
          COALESCE((
            SELECT SUM(CASE WHEN e.entry_kind = 'topup' THEN e.amount ELSE -e.amount END)
            FROM cash_fund_entries e
            WHERE e.fund_id = cf.id
              AND e.created_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta')
          ), 0)::numeric AS balance
        FROM cash_funds cf
        ORDER BY cf.id
      `
    : await sql`
        SELECT cf.id, cf.code, cf.name, cf.balance::numeric
        FROM cash_funds cf
        ORDER BY cf.id
      `;

  const vendorBills = await sql`
    SELECT
      vb.id, vb.doc_no, sp.name AS vendor_name, vb.amount::numeric,
      CASE
        WHEN ${end}::date IS NULL THEN vb.amount_open
        ELSE GREATEST(0, vb.amount - COALESCE((
          SELECT SUM(vp.amount) FROM vendor_payments vp
          WHERE vp.bill_id = vb.id AND vp.status = 'posted' AND vp.paid_on <= ${end}::date
            AND NOT EXISTS (
              SELECT 1 FROM stock_reversals r
              WHERE r.source_type = 'vendor_payment' AND r.source_id = vp.id
            )
        ), 0))
      END::numeric AS amount_open,
      to_char(vb.due_date, 'YYYY-MM-DD') AS due_date,
      vb.status
    FROM vendor_bills vb
    JOIN stock_parties sp ON vb.vendor_id = sp.id
    JOIN goods_receipts gr ON gr.id = vb.receipt_id
    WHERE vb.status <> 'reversed'
      AND NOT EXISTS (
        SELECT 1 FROM stock_reversals r
        WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id
      )
      AND (${end}::date IS NULL OR gr.posted_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
    ORDER BY vb.id DESC
  `;

  const salesSummary = await sql`
    SELECT
      si.id, si.doc_no, sp.name AS party_name, sp.party_kind,
      si.amount::numeric AS omzet,
      si.cogs_amount::numeric AS cogs,
      (si.amount - si.cogs_amount)::numeric AS laba,
      ROUND(((si.amount - si.cogs_amount) / NULLIF(si.cogs_amount, 0) * 100), 2)::numeric AS margin_achieved_pct
    FROM sales_invoices si
    JOIN stock_parties sp ON si.party_id = sp.id
    JOIN shipments sh ON sh.id = si.shipment_id
    WHERE NOT EXISTS (
        SELECT 1 FROM stock_reversals r
        WHERE r.source_type = 'sales_invoice' AND r.source_id = si.id
      )
      AND (${start}::date IS NULL OR sh.posted_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
      AND (${end}::date IS NULL OR sh.posted_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
    ORDER BY si.id DESC
  `;

  const purchasesRes = await sql`
    SELECT COALESCE(SUM(grl.all_in_value), 0)::numeric AS total
    FROM goods_receipt_lines grl
    JOIN goods_receipts gr ON gr.id = grl.receipt_id
    WHERE gr.status = 'posted'
      AND NOT EXISTS (
        SELECT 1 FROM stock_reversals r
        WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id
      )
      AND (${start}::date IS NULL OR gr.posted_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
      AND (${end}::date IS NULL OR gr.posted_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
  `;

  const cogsRes = await sql`
    SELECT COALESCE(SUM(sl.cogs_value), 0)::numeric AS total
    FROM shipment_lines sl
    JOIN shipments sh ON sh.id = sl.shipment_id
    WHERE sh.status = 'posted'
      AND NOT EXISTS (
        SELECT 1 FROM stock_reversals r
        WHERE r.source_type = 'shipment' AND r.source_id = sh.id
      )
      AND (${start}::date IS NULL OR sh.posted_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
      AND (${end}::date IS NULL OR sh.posted_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
  `;

  const openingRes = start
    ? await sql`
        SELECT COALESCE(SUM(
          CASE move_kind
            WHEN 'receipt' THEN value WHEN 'produce' THEN value
            WHEN 'consume' THEN -value WHEN 'ship' THEN -value
            ELSE value
          END
        ), 0)::numeric AS total
        FROM stock_moves
        WHERE created_at < (${start}::date AT TIME ZONE 'Asia/Jakarta')
      `
    : [{ total: 0 }];

  const countRes = await sql`
    SELECT COALESCE(SUM(value), 0)::numeric AS total
    FROM stock_moves
    WHERE move_kind = 'count'
      AND (${start}::date IS NULL OR created_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
      AND (${end}::date IS NULL OR created_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
  `;

  const channelRaw = await sql`
    SELECT
      sp.name AS channel_name,
      COALESCE(SUM(si.amount), 0)::numeric AS omzet,
      COALESCE(SUM(si.cogs_amount), 0)::numeric AS cogs,
      COALESCE(SUM(si.amount - si.cogs_amount), 0)::numeric AS laba
    FROM stock_parties sp
    LEFT JOIN sales_invoices si ON si.party_id = sp.id
      AND NOT EXISTS (
        SELECT 1 FROM stock_reversals r
        WHERE r.source_type = 'sales_invoice' AND r.source_id = si.id
      )
      AND EXISTS (
        SELECT 1 FROM shipments sh
        WHERE sh.id = si.shipment_id
          AND (${start}::date IS NULL OR sh.posted_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
          AND (${end}::date IS NULL OR sh.posted_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
      )
    WHERE sp.party_kind IN ('internal_outlet', 'third_party_outlet', 'catering')
    GROUP BY sp.id, sp.name
    ORDER BY omzet DESC
  `;

  const dailyRaw = await sql`
    SELECT
      to_char(sm.created_at AT TIME ZONE 'Asia/Jakarta', 'DD/MM') AS date_label,
      to_char(sm.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS full_date,
      COALESCE(SUM(CASE WHEN sm.move_kind = 'receipt' THEN sm.value ELSE 0 END), 0)::numeric AS belanja,
      COALESCE(SUM(CASE WHEN sm.move_kind = 'produce' THEN sm.value ELSE 0 END), 0)::numeric AS produksi,
      COALESCE(SUM(CASE WHEN sm.move_kind = 'ship' THEN sm.value ELSE 0 END), 0)::numeric AS penjualan_hpp
    FROM stock_moves sm
    WHERE (${start}::date IS NULL OR sm.created_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
      AND (${end}::date IS NULL OR sm.created_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
    GROUP BY 1, 2
    ORDER BY full_date ASC
  `;

  const balanceRows = balances as Array<Record<string, unknown>>;
  const inventoryValue = balanceRows.reduce((sum, row) => sum + num(row.value), 0);
  let semiQty = 0;
  let semiValue = 0;
  const byBin = new Map<string, number>();
  const byCat = new Map<string, number>();
  for (const row of balanceRows) {
    const value = num(row.value);
    byBin.set(String(row.bin_name), (byBin.get(String(row.bin_name)) ?? 0) + value);
    byCat.set(String(row.category_name ?? "Lainnya"), (byCat.get(String(row.category_name ?? "Lainnya")) ?? 0) + value);
    if (row.item_kind === "semi_finished") {
      semiQty += num(row.qty);
      semiValue += value;
    }
  }

  const purchases = num((purchasesRes[0] as { total?: unknown })?.total);
  const totalCogs = num((cogsRes[0] as { total?: unknown })?.total);
  const openingStock = num((openingRes[0] as { total?: unknown })?.total);
  const countValue = num((countRes[0] as { total?: unknown })?.total);
  const salesRows = salesSummary as Array<Record<string, unknown>>;
  const omzet = salesRows.reduce((sum, row) => sum + num(row.omzet), 0);
  const profit = salesRows.reduce((sum, row) => sum + num(row.laba), 0);
  const cashBalance = (cashFunds as Array<Record<string, unknown>>).reduce((sum, row) => sum + num(row.balance), 0);
  const openPayable = (vendorBills as Array<Record<string, unknown>>).reduce((sum, row) => sum + num(row.amount_open), 0);
  const outputUnitCost = semiQty > 0 ? semiValue / semiQty : 0;

  const payload = {
    balances,
    cashFunds,
    vendorBills,
    salesSummary,
    kpis: {
      cashBalance,
      inventoryValue,
      openPayable,
      purchases,
      cogs: totalCogs,
      omzet,
      profit,
      outputUnitCost,
      openingStock,
      countValue,
    },
    reconciliation: {
      totalStockValue: inventoryValue,
      totalCogs,
      sumStockPlusCogs: inventoryValue + totalCogs,
      totalPurchases: purchases,
      openingStock,
      countValue,
      isBalanced: Math.abs(openingStock + purchases + countValue - totalCogs - inventoryValue) < 1,
    },
    charts: {
      stockByBin: [...byBin.entries()].map(([label, total_value]) => ({ label, total_value })),
      stockByCategory: [...byCat.entries()].map(([label, total_value]) => ({ label, total_value })),
      channelPerformance: (channelRaw as Array<Record<string, unknown>>).map((row) => ({
        channel_name: String(row.channel_name),
        omzet: num(row.omzet),
        cogs: num(row.cogs),
        laba: num(row.laba),
      })),
      dailyMovements: (dailyRaw as Array<Record<string, unknown>>).map((row) => ({
        date_label: String(row.date_label),
        full_date: String(row.full_date),
        belanja: num(row.belanja),
        produksi: num(row.produksi),
        penjualan_hpp: num(row.penjualan_hpp),
      })),
    },
    filters: { startDate: start, endDate: end },
  };

  return NextResponse.json(jsonSafe(payload));
}
