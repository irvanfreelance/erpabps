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
    SELECT 
      si.id,
      si.sku,
      si.name,
      si.item_kind,
      si.category_id,
      c.name as category_name,
      si.uom_id,
      su.code as uom_code,
      si.is_stocked
    FROM stock_items si
    JOIN stock_item_categories c ON si.category_id = c.id
    JOIN stock_uoms su ON si.uom_id = su.id
    WHERE si.deleted_at IS NULL
    ORDER BY si.sku ASC
  `;
  return NextResponse.json(jsonSafe({ data: rows }));
}

export async function POST(req: Request) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { sku, name, category_id, uom_id, item_kind, is_stocked } = body;
    if (!sku || !name || !category_id || !uom_id) {
      return NextResponse.json({ error: "SKU, nama barang, kategori, dan satuan wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO stock_items (sku, name, category_id, uom_id, item_kind, is_stocked)
      VALUES (
        ${String(sku).trim().toUpperCase()},
        ${String(name).trim()},
        ${Number(category_id)},
        ${Number(uom_id)},
        ${String(item_kind || "raw_material").trim()},
        ${is_stocked !== undefined ? Boolean(is_stocked) : true}
      )
      RETURNING id, sku, name, item_kind, is_stocked
    `;

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "stock_items",
      entityId: String(inserted.id),
      valueAfter: { sku: inserted.sku, name: inserted.name },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const errCode = typeof err === "object" && err !== null && "code" in err ? (err as { code?: string }).code : undefined;
    const message = err instanceof Error ? err.message : "Gagal menambah barang";
    if (errCode === "23505" || message.includes("duplicate key")) {
      return NextResponse.json({ error: "SKU sudah dipakai" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
