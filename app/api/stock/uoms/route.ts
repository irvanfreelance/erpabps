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
    SELECT id, code, name
    FROM stock_uoms
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
    const { code, name } = body;
    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama satuan UOM wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO stock_uoms (code, name)
      VALUES (${String(code).trim().toUpperCase()}, ${String(name).trim()})
      RETURNING id, code, name
    `;

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "stock_uoms",
      entityId: String(inserted.id),
      valueAfter: { code: inserted.code, name: inserted.name },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const code = typeof err === "object" && err !== null && "code" in err ? (err as { code?: string }).code : undefined;
    const message = err instanceof Error ? err.message : "Gagal menambah satuan";
    if (code === "23505" || message.includes("duplicate key")) {
      return NextResponse.json({ error: "Kode satuan sudah dipakai" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
