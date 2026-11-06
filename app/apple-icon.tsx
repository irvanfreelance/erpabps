import { orgIconImage } from "@/lib/org/favicon-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 180, height: 180 };

export default async function AppleIcon() {
  return orgIconImage(180);
}
