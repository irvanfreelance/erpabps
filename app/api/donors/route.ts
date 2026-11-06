import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { normalizePhone } from "@/lib/utils/phone";
import { createDonorSchema } from "@/lib/validators/donor";
import type { DonorListRow } from "@/types/donor";

export async function GET(req: Request) {
  const g = await guard("donors", "read");
  if (g.error) return g.error;
  const { searchParams } = new URL(req.url);
  const sql = getDb();
  const page = Number(searchParams.get("page") ?? 1) || 1;
  const limit = Number(searchParams.get("limit") ?? 50) || 50;
  const offset = (page - 1) * limit;
  const q = searchParams.get("q")?.trim();
  const assignedTo = searchParams.get("assignedTo");
  const status = searchParams.get("status");
  const segmen = searchParams.get("segmen");
  const rows = await sql`
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
  `;
  const countRows = await sql`
    SELECT COUNT(*)::int AS n
    FROM donor_search_index i
    JOIN donors d ON d.id = i.donor_id
    WHERE d.deleted_at IS NULL
      AND (${q ?? null}::text IS NULL OR i.search_doc->>'nama' ILIKE '%' || lower(${q ?? ""}) || '%'
           OR d.no_hp_canonical ILIKE '%' || ${q ?? ""} || '%')
  `;
  return NextResponse.json(
    jsonSafe({ rows: rows as DonorListRow[], total: (countRows[0] as { n: number }).n, page, limit }),
  );
}

export async function POST(req: Request) {
  const g = await guard("donors", "create");
  if (g.error) return g.error;
  const parsed = createDonorSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const phone = normalizePhone(parsed.data.noHpCanonical);
  if (!phone) return NextResponse.json({ error: "Nomor HP tidak valid" }, { status: 400 });
  const sql = getDb();
  const rows = await sql`
    INSERT INTO donors (no_hp_canonical, nama_lengkap, email, status_kontak, tags, assigned_to, assigned_at, sumber_registrasi)
    VALUES (
      ${phone}, ${parsed.data.namaLengkap}, ${parsed.data.email ?? null},
      ${parsed.data.statusKontak ?? "aktif"}, ${parsed.data.tags ?? []}, ${parsed.data.assignedTo ?? null},
      ${parsed.data.assignedTo ? new Date().toISOString() : null}, 'manual'
    )
    RETURNING *
  `;
  const donor = rows[0] as { id: string };
  await sql`SELECT fn_rebuild_search_index(${donor.id}::bigint)`;
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "donor",
    entityId: String(donor.id),
    valueAfter: rows[0],
  });
  return NextResponse.json(rows[0]);
}
