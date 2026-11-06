import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { fallbackOrg, type OrgProfile } from "@/types/org";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Warna harus hex #RRGGBB");

const schema = z.object({
  nama: z.string().min(2),
  namaSingkat: z.string().min(1).max(40),
  tagline: z.string().max(200),
  logoUrl: z.union([z.string().url(), z.literal(""), z.null()]),
  faviconUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  primaryColor: hex,
  sidebarColor: hex,
  accentColor: hex,
});

export async function GET() {
  try {
    const g = await guard("app_config", "read");
    if (g.error) return g.error;
    const sql = getDb();
    const rows = await sql`SELECT * FROM org_profile WHERE id = 1 LIMIT 1`;
    if (!rows[0]) return NextResponse.json(fallbackOrg());
    return NextResponse.json(jsonSafe(rows[0]) as OrgProfile);
  } catch {
    return NextResponse.json(fallbackOrg());
  }
}

export async function PUT(req: Request) {
  const g = await guard("app_config", "config");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const logoUrl = parsed.data.logoUrl ? parsed.data.logoUrl : null;
  const faviconUrl = parsed.data.faviconUrl ? parsed.data.faviconUrl : null;
  const sql = getDb();
  const rows = await sql`
    INSERT INTO org_profile (
      id, nama, nama_singkat, tagline, logo_url, favicon_url,
      primary_color, sidebar_color, accent_color, is_seed_default, updated_at
    ) VALUES (
      1, ${parsed.data.nama}, ${parsed.data.namaSingkat}, ${parsed.data.tagline}, ${logoUrl}, ${faviconUrl},
      ${parsed.data.primaryColor}, ${parsed.data.sidebarColor}, ${parsed.data.accentColor}, FALSE, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      nama = EXCLUDED.nama,
      nama_singkat = EXCLUDED.nama_singkat,
      tagline = EXCLUDED.tagline,
      logo_url = EXCLUDED.logo_url,
      favicon_url = EXCLUDED.favicon_url,
      primary_color = EXCLUDED.primary_color,
      sidebar_color = EXCLUDED.sidebar_color,
      accent_color = EXCLUDED.accent_color,
      is_seed_default = FALSE,
      updated_at = now()
    RETURNING *
  `;
  await sql`
    INSERT INTO app_config (key, value, description)
    VALUES ('app_name', ${parsed.data.nama}, 'Nama aplikasi')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  await logAudit({
    userId: g.session!.user.id,
    action: "update",
    entityType: "org_profile",
    entityId: "1",
    valueAfter: parsed.data,
  });
  return NextResponse.json(jsonSafe(rows[0]) as OrgProfile);
}
