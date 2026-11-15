import { NextRequest } from "next/server";
import { orgIconImage } from "@/lib/org/favicon-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get("size") ?? "192");
  const size = raw === 512 ? 512 : 192;
  return orgIconImage(size);
}

