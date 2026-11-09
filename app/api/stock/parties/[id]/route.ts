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
    const { code, name, party_kind } = body;
    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama rekanan wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [updated] = await sql`
      UPDATE stock_parties
      SET code = ${String(code).trim().toUpperCase()},
          name = ${String(name).trim()},
          party_kind = ${String(party_kind || "vendor").trim()}
      WHERE id = ${id}
      RETURNING id, code, name, party_kind
    `;

    if (!updated) {
      return NextResponse.json({ error: "Rekanan tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "update",
      entityType: "stock_parties",
      entityId: String(id),
      valueAfter: { code: updated.code, name: updated.name },
    });

    return NextResponse.json(jsonSafe({ data: updated }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah rekanan";
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
      UPDATE stock_parties
      SET deleted_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return NextResponse.json({ error: "Rekanan tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "delete",
      entityType: "stock_parties",
      entityId: String(id),
      valueAfter: { deleted_at: new Date().toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus rekanan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
