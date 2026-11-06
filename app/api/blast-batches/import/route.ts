import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { normalizePhone } from "@/lib/utils/phone";

export async function POST(req: Request) {
  const g = await guard("blast_batches", "import");
  if (g.error) return g.error;
  const body = await req.json();
  const sql = getDb();
  const batch = await sql`
    INSERT INTO blast_batches (campaign_id, vendor_profile_id, tgl_blast, import_status, diimport_oleh)
    VALUES (${body.campaignId}, ${body.vendorProfileId ?? null}, ${body.tglBlast}, 'processing', ${g.session!.user.id})
    RETURNING id
  `;
  const batchId = String((batch[0] as { id: string }).id);
  const rows: Array<{ phone: string; status?: string }> = body.rows ?? [];
  let terkirim = 0;
  let gagal = 0;
  for (const r of rows) {
    const phone = normalizePhone(r.phone);
    if (!phone) continue;
    const found = await sql`
      SELECT d.*, u.nama AS assigned_nama
      FROM donors d
      LEFT JOIN users u ON u.id = d.assigned_to
      WHERE d.no_hp_canonical = ${phone} AND d.deleted_at IS NULL
    `;
    const donor = jsonSafe(found[0] ?? null) as { id: string } | null;
    if (!donor) continue;
    const status = r.status === "failed" ? "nomor_mati" : "terkirim";
    if (status === "terkirim") terkirim += 1;
    else gagal += 1;
    await sql`
      INSERT INTO blast_records (donor_id, blast_batch_id, tgl_kirim, status_kirim, raw_vendor_status)
      VALUES (${String(donor.id)}, ${batchId}, now(), ${status}, ${r.status ?? null})
    `;
    await sql`SELECT fn_rebuild_search_index(${String(donor.id)}::bigint)`;
  }
  await sql`
    UPDATE blast_batches SET import_status = 'done', jumlah_target = ${rows.length}, jumlah_terkirim = ${terkirim}, jumlah_gagal = ${gagal}
    WHERE id = ${batchId}
  `;
  await sql`
    INSERT INTO data_imports (entity_type, file_name, row_count_total, row_count_new, status, blast_batch_id, diupload_oleh, completed_at)
    VALUES ('blast_report', ${body.fileName ?? "import.json"}, ${rows.length}, ${terkirim}, 'done', ${batchId}, ${g.session!.user.id}, now())
  `;
  await logAudit({ userId: g.session!.user.id, action: "import", entityType: "blast_batch", entityId: batchId });
  return NextResponse.json({ batchId, terkirim, gagal });
}
