import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await guardStockApi();
  if (errorResponse) return errorResponse;

  const sql = getDb();
  const rows = await sql`
    SELECT bom.id, bom.output_item_id, bom.output_qty::numeric,
           si.name as output_item_name, si.sku as output_item_sku,
           to_char(bom.effective_from, 'YYYY-MM-DD') as effective_from,
           to_char(bom.effective_to, 'YYYY-MM-DD') as effective_to,
           (SELECT json_agg(json_build_object(
             'id', bl.id,
             'item_id', bl.item_id,
             'item_name', ing.name,
             'sku', ing.sku,
             'qty', bl.qty::numeric
           )) FROM stock_bom_lines bl JOIN stock_items ing ON bl.item_id = ing.id WHERE bl.bom_id = bom.id) as lines
    FROM stock_boms bom
    JOIN stock_items si ON bom.output_item_id = si.id
    ORDER BY bom.id DESC
  `;
  return NextResponse.json(jsonSafe({ data: rows }));
}

export async function POST(req: Request) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { output_item_id, output_qty, effective_from, lines } = body;
    if (!output_item_id || !output_qty || !effective_from || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Barang hasil, target kuantitas, tanggal mulai, dan minimal 1 bahan resep wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO stock_boms (output_item_id, output_qty, effective_from)
      VALUES (${Number(output_item_id)}, ${Number(output_qty)}, ${String(effective_from)})
      RETURNING id, output_item_id, output_qty::numeric
    `;

    for (const line of lines) {
      if (line.item_id && line.qty) {
        await sql`
          INSERT INTO stock_bom_lines (bom_id, item_id, qty)
          VALUES (${Number(inserted.id)}, ${Number(line.item_id)}, ${Number(line.qty)})
        `;
      }
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "stock_boms",
      entityId: String(inserted.id),
      valueAfter: { output_item_id: inserted.output_item_id, output_qty: inserted.output_qty },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambah resep BOM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
