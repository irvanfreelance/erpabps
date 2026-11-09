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
    SELECT id, code, name, bin_kind, location_id, is_receiving
    FROM stock_bins
    WHERE deleted_at IS NULL
    ORDER BY code ASC
  `;
  return NextResponse.json(jsonSafe({ data: rows }));
}

export async function POST(req: Request) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { code, name, bin_kind, location_id, is_receiving } = body;
    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama bin lokasi wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO stock_bins (code, name, bin_kind, location_id, is_receiving)
      VALUES (
        ${String(code).trim().toUpperCase()},
        ${String(name).trim()},
        ${String(bin_kind || "storage").trim()},
        ${location_id ? Number(location_id) : null},
        ${Boolean(is_receiving)}
      )
      RETURNING id, code, name, bin_kind, is_receiving
    `;

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "stock_bins",
      entityId: String(inserted.id),
      valueAfter: { code: inserted.code, name: inserted.name },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambah bin lokasi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
