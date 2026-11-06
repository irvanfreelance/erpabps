import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";
import type { DonorListRow } from "@/types/donor";

export async function POST() {
  const g = await guard("donors", "export");
  if (g.error) return g.error;
  const sql = getDb();
  const limit = 10000;
  const offset = 0;
  const q = undefined as string | undefined;
  const assignedTo = undefined as string | undefined;
  const status = undefined as string | undefined;
  const segmen = undefined as string | undefined;
  const rows = jsonSafe(
    (await sql`
      SELECT
        d.id, d.no_hp_canonical, d.nama_lengkap, d.email, d.status_kontak, d.segmen_rfm,
        d.skor_r, d.skor_f, d.skor_m, d.tags, d.assigned_to, u.nama AS assigned_nama,
        d.follow_up_status, d.follow_up_due_date, d.last_donation_at, d.last_donation_nominal,
        p.nama AS last_donation_program_nama, d.total_donation_lifetime, d.total_donation_count,
        COALESCE((
          SELECT jsonb_object_agg(
            fd.slug,
            COALESCE(ddf.value_json, to_jsonb(ddf.value_text), to_jsonb(ddf.value_number),
                     to_jsonb(ddf.value_date), to_jsonb(ddf.value_boolean))
          )
          FROM donor_dynamic_fields ddf
          JOIN field_definitions fd ON fd.id = ddf.field_def_id AND fd.is_active = TRUE
          WHERE ddf.donor_id = d.id
        ), '{}'::jsonb) AS dynamic
      FROM donor_search_index i
      JOIN donors d ON d.id = i.donor_id
      LEFT JOIN users u ON u.id = d.assigned_to
      LEFT JOIN programs p ON p.id = d.last_donation_program_id
      WHERE d.deleted_at IS NULL
        AND (${q ?? null}::text IS NULL OR i.search_doc->>'nama' ILIKE '%' || lower(${q ?? ""}) || '%'
             OR d.no_hp_canonical ILIKE '%' || ${q ?? ""} || '%')
        AND (${assignedTo ?? null}::text IS NULL OR d.assigned_to = ${assignedTo ?? null}::bigint)
        AND (${status ?? null}::text IS NULL OR i.search_doc->>'status' = ${status ?? ""})
        AND (${segmen ?? null}::text IS NULL OR i.search_doc->>'segmen' = ${segmen ?? ""})
      ORDER BY d.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as DonorListRow[],
  );
  const header = "id,nama,no_hp,email,segmen,status,total\n";
  const body = rows
    .map((r) =>
      [r.id, r.nama_lengkap, r.no_hp_canonical, r.email, r.segmen_rfm, r.status_kontak, r.total_donation_lifetime]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=donors.csv",
    },
  });
}
