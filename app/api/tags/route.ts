import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { tagSchema } from "@/lib/validators/tag";

function slugifyTag(nama: string) {
  return nama
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);
}

export async function GET() {
  const g = await guard("tags", "read");
  if (g.error) return g.error;
  const sql = getDb();
  return NextResponse.json({ rows: jsonSafe(await sql`SELECT * FROM tag_definitions ORDER BY is_active DESC, nama`) });
}

export async function POST(req: Request) {
  const g = await guard("tags", "config");
  if (g.error) return g.error;
  const parsed = tagSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const slug = parsed.data.slug || slugifyTag(parsed.data.nama);
  const sql = getDb();
  const rows = await sql`
    INSERT INTO tag_definitions (slug, nama, warna, deskripsi, is_active)
    VALUES (
      ${slug}, ${parsed.data.nama}, ${parsed.data.warna ?? "#01665a"},
      ${parsed.data.deskripsi ?? null}, ${parsed.data.isActive ?? true}
    )
    ON CONFLICT (slug) DO UPDATE SET
      nama = EXCLUDED.nama,
      warna = EXCLUDED.warna,
      deskripsi = EXCLUDED.deskripsi,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING *
  `;
  const row = jsonSafe(rows[0]);
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "tag",
    valueAfter: row,
  });
  return NextResponse.json(row);
}
