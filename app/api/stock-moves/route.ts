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
      sm.id,
      sm.item_id,
      si.sku,
      si.name as item_name,
      sm.bin_id,
      bin.code as bin_code,
      bin.name as bin_name,
      sm.move_kind,
      sm.qty::numeric,
      sm.value::numeric,
      sm.unit_cost::numeric,
      sm.source_type,
      sm.source_id,
      sm.created_at
    FROM stock_moves sm
    JOIN stock_items si ON sm.item_id = si.id
    JOIN stock_bins bin ON sm.bin_id = bin.id
    ORDER BY sm.id ASC
  `;

  return NextResponse.json({ data: rows });
}

