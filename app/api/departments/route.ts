import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("positions", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`SELECT id, code, name FROM departments WHERE deleted_at IS NULL ORDER BY name`;
  return NextResponse.json(jsonSafe({ rows }));
}
