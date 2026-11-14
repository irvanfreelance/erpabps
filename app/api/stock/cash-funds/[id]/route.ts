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
    const { code, name } = body;
    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama kas wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [updated] = await sql`
      UPDATE cash_funds
      SET code = ${String(code).trim().toUpperCase()},
          name = ${String(name).trim()}
      WHERE id = ${id}
      RETURNING id, code, name, balance::numeric
    `;

    if (!updated) {
      return NextResponse.json({ error: "Kas tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "update",
      entityType: "cash_funds",
      entityId: String(id),
      valueAfter: { code: updated.code, name: updated.name, balance: updated.balance },
    });

    return NextResponse.json(jsonSafe({ data: updated }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah kas";
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

    const [entryRef] = await sql`
      SELECT id FROM cash_fund_entries WHERE cash_fund_id = ${id} LIMIT 1
    `;
    if (entryRef) {
      return NextResponse.json(
        { error: "Kas tidak dapat dihapus karena sudah memiliki riwayat mutasi/entri" },
        { status: 409 }
      );
    }

    const [deleted] = await sql`
      DELETE FROM cash_funds
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return NextResponse.json({ error: "Kas tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "delete",
      entityType: "cash_funds",
      entityId: String(id),
      valueAfter: { deleted_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus kas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
