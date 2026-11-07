import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";

export async function GET(req: Request) {
  const g = await guard("locations", "read");
  if (g.error) return g.error;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "id");
  url.searchParams.set("accept-language", "id");

  const res = await fetch(url, {
    headers: { "User-Agent": "ABPS-HRD/1.0 (lokasi master)" },
    next: { revalidate: 0 },
  });
  if (!res.ok) return NextResponse.json({ error: "Pencarian tempat gagal" }, { status: 502 });
  const raw = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  const results = raw.map((r) => ({
    label: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
  }));
  return NextResponse.json({ results });
}
