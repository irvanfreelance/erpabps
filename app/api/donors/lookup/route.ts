import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";
import { normalizePhone } from "@/lib/utils/phone";

export async function GET(req: Request) {
  const g = await guard("donors", "read");
  if (g.error) return g.error;
  const phone = normalizePhone(new URL(req.url).searchParams.get("phone") ?? "");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });
  const sql = getDb();
  const donors = await sql`
    SELECT d.*, u.nama AS assigned_nama
    FROM donors d
    LEFT JOIN users u ON u.id = d.assigned_to
    WHERE d.no_hp_canonical = ${phone} AND d.deleted_at IS NULL
  `;
  const donor = jsonSafe(donors[0] ?? null);
  if (!donor) return NextResponse.json({ donor: null });
  const notes = jsonSafe(
    await sql`
      SELECT n.*, d.nama_lengkap, u.nama AS user_nama, c.nama AS campaign_nama
      FROM prospect_notes n
      JOIN donors d ON d.id = n.donor_id
      JOIN users u ON u.id = n.user_id
      LEFT JOIN campaigns c ON c.id = n.campaign_id
      WHERE (${String((donor as { id: string }).id)}::text IS NULL OR n.donor_id = ${String((donor as { id: string }).id)}::bigint)
      ORDER BY n.created_at DESC
      LIMIT 200
    `,
  );
  return NextResponse.json({ donor, notes });
}
