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
    SELECT id, code, party_kind, margin_percent::numeric,
           to_char(effective_from, 'YYYY-MM-DD') as effective_from,
           to_char(effective_to, 'YYYY-MM-DD') as effective_to
    FROM stock_price_lists
    ORDER BY id ASC
  `;
  return NextResponse.json(jsonSafe({ data: rows }));
}

export async function POST(req: Request) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { code, party_kind, margin_percent, effective_from, effective_to } = body;
    if (!code || !party_kind || margin_percent === undefined || !effective_from) {
      return NextResponse.json({ error: "Kode, kanal mitra, margin persen, dan tanggal mulai wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO stock_price_lists (code, party_kind, margin_percent, effective_from, effective_to)
      VALUES (
        ${String(code).trim().toUpperCase()},
        ${String(party_kind).trim()},
        ${Number(margin_percent)},
        ${String(effective_from)},
        ${effective_to ? String(effective_to) : null}
      )
      RETURNING id, code, party_kind, margin_percent::numeric
    `;

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "stock_price_lists",
      entityId: String(inserted.id),
      valueAfter: { code: inserted.code, margin_percent: inserted.margin_percent },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambah daftar harga";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
