import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { checkPermission, type Action } from "@/lib/auth/rbac";
import type { Role } from "@/types/auth";

export async function guard(resource: string, action: Action) {
  const session = await getServerSession();
  if (!checkPermission(session.user.role as Role, resource, action)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export function zodError(error: { issues?: { message: string }[]; flatten: () => unknown }) {
  const message = error.issues?.[0]?.message ?? "Data tidak valid";
  return NextResponse.json({ error: message, details: error.flatten() }, { status: 400 });
}
