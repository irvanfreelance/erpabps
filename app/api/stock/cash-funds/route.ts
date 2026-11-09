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
    SELECT id, code, name, balance::numeric
    FROM cash_funds
    ORDER BY id ASC
  `;
  return NextResponse.json(jsonSafe({ data: rows }));
}

export async function POST(req: Request) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { code, name, balance } = body;
    if (!code || !name) {
      return NextResponse.json({ error: "Kode dan nama kas wajib diisi" }, { status: 400 });
    }

    const sql = getDb();
    const [inserted] = await sql`
      INSERT INTO cash_funds (code, name, balance)
      VALUES (
        ${String(code).trim().toUpperCase()},
        ${String(name).trim()},
        ${Number(balance || 0)}
      )
      RETURNING id, code, name, balance::numeric
    `;

    await logAudit({
      userId: session?.user?.id ? String(session.user.id) : null,
      action: "create",
      entityType: "cash_funds",
      entityId: String(inserted.id),
      valueAfter: { code: inserted.code, name: inserted.name, balance: inserted.balance },
    });

    return NextResponse.json(jsonSafe({ data: inserted }), { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambah kas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
