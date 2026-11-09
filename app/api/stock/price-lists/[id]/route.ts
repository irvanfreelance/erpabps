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
    const { code, party_kind, margin_percent, effective_from, effective_to } = body;
    if (!code || !party_kind || margin_percent === undefined || !effective_from) {
      return NextResponse.json({ error: "Kode, kanal mitra, margin persen, dan tanggal mulai wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [updated] = await sql`
      UPDATE stock_price_lists
      SET code = ${String(code).trim().toUpperCase()},
          party_kind = ${String(party_kind).trim()},
          margin_percent = ${Number(margin_percent)},
          effective_from = ${String(effective_from)},
          effective_to = ${effective_to ? String(effective_to) : null}
      WHERE id = ${id}
      RETURNING id, code, party_kind, margin_percent::numeric
    `;

    if (!updated) {
      return NextResponse.json({ error: "Daftar harga tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "update",
      entityType: "stock_price_lists",
      entityId: String(id),
      valueAfter: { code: updated.code, margin_percent: updated.margin_percent },
    });

    return NextResponse.json(jsonSafe({ data: updated }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah daftar harga";
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

    const [deleted] = await sql`
      DELETE FROM stock_price_lists
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return NextResponse.json({ error: "Daftar harga tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "delete",
      entityType: "stock_price_lists",
      entityId: String(id),
      valueAfter: { deleted_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus daftar harga";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
