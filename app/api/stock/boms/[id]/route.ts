import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";
import { logAudit } from "@/lib/db/audit";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  try {
    const sql = getDb();

    // Cek apakah dipakai di production orders
    const used = await sql`
      SELECT count(*)::int as n
      FROM production_orders
      WHERE bom_id = ${id}
    `;
    if (used[0]?.n > 0) {
      return NextResponse.json(
        { error: "Resep BOM tidak dapat dihapus karena sudah memiliki riwayat perintah produksi" },
        { status: 400 }
      );
    }

    await sql`DELETE FROM stock_bom_lines WHERE bom_id = ${id}`;
    const [deleted] = await sql`DELETE FROM stock_boms WHERE id = ${id} RETURNING id`;

    if (!deleted) {
      return NextResponse.json({ error: "Resep BOM tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "delete",
      entityType: "stock_boms",
      entityId: String(id),
      valueAfter: { deleted_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus resep BOM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
