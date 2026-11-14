import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";

export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  const { errorResponse } = await guardStockApi();
  if (errorResponse) return errorResponse;

  let start: string | null = null;
  let end: string | null = null;
  let itemId: string | null = null;
  let binId: string | null = null;
  if (request) {
    const { searchParams } = new URL(request.url);
    const s = searchParams.get("start_date") || "";
    const e = searchParams.get("end_date") || "";
    const item = searchParams.get("item_id") || "";
    const bin = searchParams.get("bin_id") || "";
    start = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    end = /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : null;
    itemId = /^\d+$/.test(item) ? item : null;
    binId = /^\d+$/.test(bin) ? bin : null;
  }

  const sql = getDb();
  const rows = await sql`
    WITH signed AS (
      SELECT
        sm.id, sm.item_id, si.sku, si.name AS item_name, sm.bin_id,
        bin.code AS bin_code, bin.name AS bin_name, sm.move_kind,
        sm.qty::numeric, sm.value::numeric, sm.unit_cost::numeric,
        sm.source_type, sm.source_id, sm.created_at,
        CASE sm.move_kind
          WHEN 'receipt' THEN sm.qty WHEN 'produce' THEN sm.qty
          WHEN 'consume' THEN -sm.qty WHEN 'ship' THEN -sm.qty
          ELSE sm.qty
        END AS signed_qty
      FROM stock_moves sm
      JOIN stock_items si ON sm.item_id = si.id
      JOIN stock_bins bin ON sm.bin_id = bin.id
    ),
    running AS (
      SELECT *, SUM(signed_qty) OVER (PARTITION BY item_id, bin_id ORDER BY created_at, id) AS running_qty
      FROM signed
    )
    SELECT id, item_id, sku, item_name, bin_id, bin_code, bin_name, move_kind,
           qty, value, unit_cost, source_type, source_id, created_at, running_qty::numeric
    FROM running
    WHERE (${start}::date IS NULL OR created_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
      AND (${end}::date IS NULL OR created_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
      AND (${itemId}::bigint IS NULL OR item_id = ${itemId}::bigint)
      AND (${binId}::bigint IS NULL OR bin_id = ${binId}::bigint)
    ORDER BY created_at DESC, id DESC
  `;

  return NextResponse.json({ data: rows });
}
