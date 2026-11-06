import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("data_imports", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT i.*, u.nama AS uploaded_by
    FROM data_imports i JOIN users u ON u.id = i.diupload_oleh
    ORDER BY i.created_at DESC
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}
