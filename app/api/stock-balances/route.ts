import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await guardStockApi();
  if (errorResponse) return errorResponse;

  const sql = getDb();
  const rows = await sql`
    SELECT 
      sb.id,
      sb.item_id,
      si.sku,
      si.name as item_name,
      si.item_kind,
      su.code as uom_code,
      sb.bin_id,
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

  return NextResponse.json({ data: rows });
}

