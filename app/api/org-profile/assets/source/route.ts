import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";
import { fallbackOrg, type OrgProfile } from "@/types/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOrg(): Promise<OrgProfile> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM org_profile WHERE id = 1 LIMIT 1`;
    if (!rows[0]) return fallbackOrg();
    return jsonSafe(rows[0]) as OrgProfile;
  } catch {
    return fallbackOrg();
  }
}

export async function GET(req: Request) {
  const g = await guard("app_config", "read");
  if (g.error) return g.error;
  const kind = new URL(req.url).searchParams.get("kind") === "favicon" ? "favicon" : "logo";
  const org = await loadOrg();
  const url = kind === "favicon" ? org.favicon_url || org.logo_url : org.logo_url;
  if (!url) return NextResponse.json({ error: "Belum ada logo" }, { status: 404 });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "Gagal mengambil gambar" }, { status: 502 });
  const type = res.headers.get("content-type")?.split(";")[0] || "image/png";
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
    },
  });
}
