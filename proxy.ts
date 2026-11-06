import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { UI_SESSION_COOKIE } from "@/lib/auth/ui-gate";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.get(UI_SESSION_COOKIE)?.value === "1";

  if (pathname === "/login") {
    if (signedIn) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL("/login", request.url);
    const next = `${pathname}${search}`;
    if (next !== "/") login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
