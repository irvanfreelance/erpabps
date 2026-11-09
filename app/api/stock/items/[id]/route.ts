import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  try {
    const body = await req.json();
    const { sku, name, category_id, uom_id, item_kind, is_stocked } = body;
    if (!sku || !name || !category_id || !uom_id) {
      return NextResponse.json({ error: "SKU, nama barang, kategori, dan satuan wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [updated] = await sql`
      UPDATE stock_items
      SET sku = ${String(sku).trim().toUpperCase()},
          name = ${String(name).trim()},
          category_id = ${Number(category_id)},
          uom_id = ${Number(uom_id)},
          item_kind = ${String(item_kind || "raw_material").trim()},
          is_stocked = ${is_stocked !== undefined ? Boolean(is_stocked) : true}
      WHERE id = ${id}
      RETURNING id, sku, name, item_kind, is_stocked
    `;

    if (!updated) {
      return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "update",
      entityType: "stock_items",
      entityId: String(id),
      valueAfter: { sku: updated.sku, name: updated.name },
    });

    return NextResponse.json(jsonSafe({ data: updated }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah barang";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  try {
    const sql = getDb();

    // Cek apakah ada saldo di barang ini
    const balance = await sql`
      SELECT count(*)::int as n
      FROM stock_balances
      WHERE item_id = ${id} AND qty > 0
    `;
    if (balance[0]?.n > 0) {
      return NextResponse.json(
        { error: "Barang tidak dapat dihapus karena masih memiliki saldo persediaan aktif di gudang/freezer" },
        { status: 400 }
      );
    }

    const [deleted] = await sql`
      UPDATE stock_items
      SET deleted_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return NextResponse.json({ error: "Barang tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "delete",
      entityType: "stock_items",
      entityId: String(id),
      valueAfter: { deleted_at: new Date().toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus barang";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
