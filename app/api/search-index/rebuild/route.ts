import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";

export async function POST() {
  const g = await guard("search_index", "update");
  if (g.error) return g.error;
  const sql = getDb();
  const donors = await sql`SELECT id FROM donors WHERE deleted_at IS NULL`;
  for (const d of donors) {
    await sql`SELECT fn_rebuild_search_index(${String((d as { id: string }).id)}::bigint)`;
  }
  return NextResponse.json({ rebuilt: donors.length });
}
