import type { MetadataRoute } from "next";
import { GET as getOrgProfile } from "@/app/api/org-profile/route";
import { fromRoute } from "@/lib/api/from-route";
import { fallbackOrg, type OrgProfile } from "@/types/org";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let org: OrgProfile;
  try {
    org = await fromRoute<OrgProfile>(await getOrgProfile());
  } catch {
    org = fallbackOrg();
  }

  const brandName = org.nama_singkat || org.nama;
  const themeColor = org.primary_color || "#01665a";
  const v = encodeURIComponent(String(org.updated_at ?? "1"));

  return {
    name: org.nama,
    short_name: brandName,
    description: org.tagline || org.nama,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: themeColor,
    icons: [
      {
        src: `/api/pwa-icon?size=192&v=${v}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/api/pwa-icon?size=512&v=${v}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/api/pwa-icon?size=512&v=${v}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
