import { NextResponse } from "next/server";
import { getDb, type SqlClient } from "@/lib/db";
import { guardStockApi } from "@/lib/api/stock-guard";
import { logAudit } from "@/lib/db/audit";
import { StockPostError, mapStockDbError } from "@/lib/stock/posting";

type Body = Record<string, unknown>;

export async function postStockAction(
  req: Request,
  entityType: string,
  run: (sql: SqlClient, actor: string, body: Body) => Promise<string>,
) {
  const { errorResponse, session } = await guardStockApi();
  if (errorResponse) return errorResponse;
  try {
    const actor = String(session?.user?.id ?? "");
    if (!/^\d+$/.test(actor)) {
      return NextResponse.json({ error: "Sesi pengguna tidak valid" }, { status: 400 });
    }
    const body = (await req.json()) as Body;
    const id = await run(getDb(), actor, body);
    await logAudit({
      userId: actor,
      action: "post",
      entityType,
      entityId: id,
      valueAfter: { doc_no: body.doc_no ?? null },
    });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (err) {
    const mapped = err instanceof StockPostError ? err : mapStockDbError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
