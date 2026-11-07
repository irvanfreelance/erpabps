import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { checkPermission, type Action } from "@/lib/auth/rbac";
import type { Role } from "@/types/auth";

export async function guard(resource: string, action: Action) {
  const session = await getServerSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (!checkPermission(session.user.role as Role, resource, action)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export function isDuplicateEmailError(err: unknown) {
  const e = err as { code?: string; message?: string };
  if (e.code === "23505") return true;
  return /idx_emp_email|employees_email|unique/i.test(e.message ?? "");
}

export function zodError(error: { issues?: { message: string }[]; flatten: () => unknown }) {
  const message = error.issues?.[0]?.message ?? "Data tidak valid";
  return NextResponse.json({ error: message, details: error.flatten() }, { status: 400 });
}
