import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { normalizePhone } from "@/lib/utils/phone";

export async function POST(req: Request) {
  const g = await guard("data_imports", "import");
  if (g.error) return g.error;
  const body = await req.json();
  const rows: Array<{ nama: string; phone: string; email?: string }> = body.rows ?? [];
  const sql = getDb();
  let nNew = 0;
  let nMerge = 0;
  for (const r of rows) {
    const phone = normalizePhone(r.phone);
    if (!phone) continue;
    const existing = await sql`
      SELECT d.*, u.nama AS assigned_nama
      FROM donors d
      LEFT JOIN users u ON u.id = d.assigned_to
      WHERE d.no_hp_canonical = ${phone} AND d.deleted_at IS NULL
    `;
    if (jsonSafe(existing[0] ?? null)) nMerge += 1;
    else {
      const created = await sql`
        INSERT INTO donors (no_hp_canonical, nama_lengkap, email, status_kontak, tags, assigned_to, assigned_at, sumber_registrasi)
        VALUES (
          ${phone}, ${r.nama}, ${r.email ?? null},
          ${"aktif"}, ${[]}, ${null},
          ${null}, 'manual'
        )
        RETURNING *
      `;
      const donor = created[0] as { id: string };
      await sql`SELECT fn_rebuild_search_index(${donor.id}::bigint)`;
      nNew += 1;
    }
  }
  await sql`
    INSERT INTO data_imports (entity_type, file_name, row_count_total, row_count_new, row_count_merge, status, diupload_oleh, completed_at)
    VALUES ('donors', ${body.fileName ?? "upload.json"}, ${rows.length}, ${nNew}, ${nMerge}, 'done', ${g.session!.user.id}, now())
  `;
  await logAudit({ userId: g.session!.user.id, action: "import", entityType: "donor", valueAfter: { nNew, nMerge } });
  return NextResponse.json({ nNew, nMerge, total: rows.length });
}
