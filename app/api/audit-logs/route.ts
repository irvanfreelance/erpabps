import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";

export async function GET() {
  const g = await guard("audit_logs", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const limit = 100;
  const rows = await sql`
    SELECT a.*, u.nama AS user_nama
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `;
  return NextResponse.json({ rows });
}
