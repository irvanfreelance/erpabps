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
    const used = await sql`SELECT count(*)::int as n FROM purchase_orders WHERE request_id = ${id}`;
    if (used[0]?.n > 0) {
      return NextResponse.json({ error: "Permintaan belanja tidak dapat dihapus karena sudah dibuatkan PO" }, { status: 400 });
    }

    await sql`DELETE FROM purchase_request_lines WHERE request_id = ${id}`;
    const [deleted] = await sql`DELETE FROM purchase_requests WHERE id = ${id} RETURNING id`;
    if (!deleted) {
      return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "delete",
      entityType: "purchase_requests",
      entityId: String(id),
      valueAfter: { deleted_id: id },
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
