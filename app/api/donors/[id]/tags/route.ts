import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { donorTagPatchSchema } from "@/lib/validators/tag";

function slugifyTag(nama: string) {
  return nama
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);
}

async function donorById(id: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT d.*, u.nama AS assigned_nama, p.nama AS last_donation_program_nama, p.slug AS last_donation_program_slug
    FROM donors d
    LEFT JOIN users u ON u.id = d.assigned_to
    LEFT JOIN programs p ON p.id = d.last_donation_program_id
    WHERE d.id = ${id} AND d.deleted_at IS NULL
  `;
  return jsonSafe(rows[0] ?? null);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("donors", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = donorTagPatchSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  if (!parsed.data.add && !parsed.data.remove) {
    return NextResponse.json({ error: "add atau remove wajib" }, { status: 400 });
  }
  const sql = getDb();
  if (parsed.data.add) {
    const nama = parsed.data.add.trim();
    const slug = slugifyTag(nama);
    if (!slug) return NextResponse.json({ error: "Nama tag tidak valid" }, { status: 400 });
    await sql`
      INSERT INTO tag_definitions (slug, nama)
      VALUES (${slug}, ${nama})
      ON CONFLICT (slug) DO UPDATE SET is_active = TRUE
      RETURNING *
    `;
    await sql`
      UPDATE donors SET tags = CASE
        WHEN tags @> ARRAY[${slug}]::text[] THEN tags
        ELSE array_append(tags, ${slug})
      END
      WHERE id = ${id}::bigint AND deleted_at IS NULL
    `;
  } else {
    const slug = parsed.data.remove!;
    await sql`
      UPDATE donors SET tags = array_remove(tags, ${slug})
      WHERE id = ${id}::bigint AND deleted_at IS NULL
    `;
  }
  await sql`SELECT fn_rebuild_search_index(${id}::bigint)`;
  const row = await donorById(id);
  await logAudit({
    userId: g.session!.user.id,
    donorId: id,
    action: "update",
    entityType: "donor_tag",
    entityId: id,
    valueAfter: parsed.data,
  });
  return NextResponse.json(row);
}
