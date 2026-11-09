import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { doc_no, party_id, ordered_on, lines } = body;
    if (!doc_no || !party_id || !ordered_on || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Nomor order, pelanggan/kanal, tanggal order, dan minimal 1 item penjualan wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO sales_orders (doc_no, party_id, ordered_on, status, created_by)
      VALUES (
        ${String(doc_no).trim().toUpperCase()},
        ${Number(party_id)},
        ${String(ordered_on)},
        'draft',
        ${session?.user?.id ? Number(session.user.id) : null}
      )
      RETURNING id, doc_no, status
    `;

    for (const l of lines) {
      if (l.item_id && l.qty) {
        await sql`
          INSERT INTO sales_order_lines (order_id, item_id, qty)
          VALUES (${inserted.id}, ${Number(l.item_id)}, ${Number(l.qty)})
        `;
      }
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "sales_orders",
      entityId: String(inserted.id),
      valueAfter: { doc_no: inserted.doc_no },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat sales order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
