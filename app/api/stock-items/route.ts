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
      si.id,
      si.sku,
      si.name,
      si.item_kind,
      si.is_stocked,
      c.name as category_name,
      u.code as uom_code,
      u.name as uom_name
    FROM stock_items si
    JOIN stock_item_categories c ON si.category_id = c.id
    JOIN stock_uoms u ON si.uom_id = u.id
    WHERE si.deleted_at IS NULL
    ORDER BY si.sku
  `;

  return NextResponse.json({ data: rows });
}

