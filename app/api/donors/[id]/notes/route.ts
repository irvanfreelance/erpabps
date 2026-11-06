import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { prospectNoteSchema } from "@/lib/validators/donor";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("prospect_notes", "read");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  const rows = await sql`
    SELECT n.*, d.nama_lengkap, u.nama AS user_nama, c.nama AS campaign_nama
    FROM prospect_notes n
    JOIN donors d ON d.id = n.donor_id
    JOIN users u ON u.id = n.user_id
    LEFT JOIN campaigns c ON c.id = n.campaign_id
    WHERE (${id}::text IS NULL OR n.donor_id = ${id}::bigint)
    ORDER BY n.created_at DESC
    LIMIT 200
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("prospect_notes", "create");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = prospectNoteSchema.safeParse({ ...(await req.json()), donorId: id });
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO prospect_notes (donor_id, user_id, campaign_id, tgl_prospek, channel, respon_donatur, catatan_bebas, source)
    VALUES (
      ${parsed.data.donorId}, ${g.session!.user.id}, ${parsed.data.campaignId ?? null},
      ${parsed.data.tglProspek ?? new Date().toISOString().slice(0, 10)},
      ${parsed.data.channel ?? "manual"}, ${parsed.data.responDonatur ?? null}, ${parsed.data.catatanBebas ?? null},
      ${parsed.data.source ?? "web_app"}
    )
    RETURNING *
  `;
  await sql`SELECT fn_rebuild_search_index(${parsed.data.donorId}::bigint)`;
  await logAudit({
    userId: g.session!.user.id,
    donorId: id,
    action: "create",
    entityType: "prospect_note",
    source: parsed.data.source ?? "web_app",
  });
  return NextResponse.json(rows[0]);
}
