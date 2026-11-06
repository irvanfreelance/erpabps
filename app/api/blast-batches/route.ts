import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("blast_batches", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT b.*, c.nama AS campaign_nama, v.nama_vendor, u.nama AS imported_by_nama
    FROM blast_batches b
    LEFT JOIN campaigns c ON c.id = b.campaign_id
    LEFT JOIN vendor_profiles v ON v.id = b.vendor_profile_id
    JOIN users u ON u.id = b.diimport_oleh
    ORDER BY b.tgl_blast DESC
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}
