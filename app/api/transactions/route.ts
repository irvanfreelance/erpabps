import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET(req: Request) {
  const g = await guard("transactions", "read");
  if (g.error) return g.error;
  const { searchParams } = new URL(req.url);
  const donorId = searchParams.get("donorId");
  const limit = Number(searchParams.get("limit") ?? 100) || 100;
  const sql = getDb();
  if (donorId) {
    const rows = await sql`
      SELECT t.*, p.nama AS program_nama, c.nama AS campaign_nama
      FROM transactions t
      JOIN programs p ON p.id = t.program_id
      LEFT JOIN campaigns c ON c.id = t.campaign_id
      WHERE t.donor_id = ${donorId}
      ORDER BY t.tgl_transaksi DESC
    `;
    return NextResponse.json({ rows: jsonSafe(rows) });
  }
  const rows = await sql`
    SELECT t.*, d.nama_lengkap, p.nama AS program_nama, c.nama AS campaign_nama
    FROM transactions t
    JOIN donors d ON d.id = t.donor_id
    JOIN programs p ON p.id = t.program_id
    LEFT JOIN campaigns c ON c.id = t.campaign_id
    ORDER BY t.tgl_transaksi DESC, t.id DESC
    LIMIT ${limit}
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}

export async function POST(req: Request) {
  const g = await guard("transactions", "create");
  if (g.error) return g.error;
  const body = await req.json();
  const sql = getDb();
  const bulan = String(body.tglTransaksi).slice(0, 7);
  const rows = await sql`
    INSERT INTO transactions (donor_id, program_id, campaign_id, tgl_transaksi, bulan_program, nominal, status, sumber)
    VALUES (${body.donorId}, ${body.programId}, ${body.campaignId ?? null}, ${body.tglTransaksi}, ${bulan}, ${body.nominal}, ${body.status ?? "paid"}, ${body.sumber ?? "manual"})
    RETURNING *
  `;
  await sql`SELECT fn_rebuild_search_index(${body.donorId}::bigint)`;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "transaction", donorId: body.donorId, valueAfter: body });
  return NextResponse.json(rows[0]);
}
