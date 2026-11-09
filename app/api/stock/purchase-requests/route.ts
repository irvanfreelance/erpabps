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
    const { doc_no, source_unit, needed_on, lines } = body;
    if (!doc_no || !source_unit || !needed_on || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Nomor dokumen, unit asal, tanggal, dan minimal 1 item belanja wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO purchase_requests (doc_no, source_unit, needed_on, status, created_by, posted_at)
      VALUES (
        ${String(doc_no).trim().toUpperCase()},
        ${String(source_unit).trim().toLowerCase()},
        ${String(needed_on)},
        'draft',
        ${session?.user?.id ? Number(session.user.id) : null},
        NOW()
      )
      RETURNING id, doc_no, status
    `;

    for (const l of lines) {
      if (l.item_id && l.qty) {
        await sql`
          INSERT INTO purchase_request_lines (request_id, item_id, qty)
          VALUES (${inserted.id}, ${Number(l.item_id)}, ${Number(l.qty)})
        `;
      }
    }

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "purchase_requests",
      entityId: String(inserted.id),
      valueAfter: { doc_no: inserted.doc_no },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat permintaan belanja";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
