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
      return NextResponse.json({ error: "Kode dan nama satuan UOM wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [updated] = await sql`
      UPDATE stock_uoms
      SET code = ${String(code).trim().toUpperCase()},
          name = ${String(name).trim()}
      WHERE id = ${id}
      RETURNING id, code, name
    `;

    if (!updated) {
      return NextResponse.json({ error: "Satuan UOM tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "update",
      entityType: "stock_uoms",
      entityId: String(id),
      valueAfter: { code: updated.code, name: updated.name },
    });

    return NextResponse.json(jsonSafe({ data: updated }));
  } catch (err: unknown) {
    const errCode = typeof err === "object" && err !== null && "code" in err ? (err as { code?: string }).code : undefined;
    const message = err instanceof Error ? err.message : "Gagal mengubah satuan UOM";
    if (errCode === "23505" || message.includes("duplicate key")) {
      return NextResponse.json({ error: "Kode satuan sudah dipakai" }, { status: 409 });
    }
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

    // Cek apakah UOM sedang dipakai oleh item
    const used = await sql`
      SELECT count(*)::int as n
      FROM stock_items
      WHERE uom_id = ${id} AND deleted_at IS NULL
    `;
    if (used[0]?.n > 0) {
      return NextResponse.json(
        { error: "Satuan UOM tidak dapat dihapus karena masih digunakan oleh master barang" },
        { status: 400 }
      );
    }

    const [deleted] = await sql`
      UPDATE stock_uoms
      SET deleted_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return NextResponse.json({ error: "Satuan UOM tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "delete",
      entityType: "stock_uoms",
      entityId: String(id),
      valueAfter: { deleted_at: new Date().toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus satuan UOM";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
