import { ImageResponse } from "next/og";
import { GET as getOrgProfile } from "@/app/api/org-profile/route";
import { fromRoute } from "@/lib/api/from-route";
import { fallbackOrg, type OrgProfile } from "@/types/org";

async function imageSrc(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const type = res.headers.get("content-type")?.split(";")[0] || "image/png";
  if (!type.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buf.toString("base64")}`;
}

export async function orgIconImage(size: number) {
  let org: OrgProfile;
  try {
    org = await fromRoute<OrgProfile>(await getOrgProfile());
  } catch {
    org = fallbackOrg();
  }
  const remote = org.favicon_url || org.logo_url;
  let src: string | null = null;
  if (remote) {
    try {
      src = await imageSrc(remote);
    } catch {
      src = null;
    }
  }

  const letter = (org.nama_singkat || org.nama || "CRM").slice(0, 2).toUpperCase();
  const color = org.primary_color || "#01665a";

  return new ImageResponse(
    src ? (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={size} height={size} alt="" style={{ objectFit: "contain" }} />
      </div>
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          color: "#fff",
          fontSize: Math.round(size * 0.4),
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        {letter}
      </div>
    ),
    { width: size, height: size },
  );
}
