import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";

export async function POST() {
  const g = await guard("rfm", "update");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT fn_recalculate_rfm() AS n`;
  const donors = await sql`SELECT id FROM donors WHERE deleted_at IS NULL`;
  for (const d of donors) {
    await sql`SELECT fn_rebuild_search_index(${String((d as { id: string }).id)}::bigint)`;
  }
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "rfm", valueAfter: rows[0] });
  return NextResponse.json(rows[0]);
}
