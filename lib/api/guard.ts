import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { checkPermission } from "@/lib/auth/rbac";
import type { Role } from "@/types/auth";

export async function guard(resource: string, action: "read" | "create" | "update" | "delete" | "assign" | "import" | "export" | "config") {
  const session = await getServerSession();
  if (!checkPermission(session.user.role as Role, resource, action)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export function zodError(error: { flatten: () => unknown }) {
  return NextResponse.json({ error: error.flatten() }, { status: 400 });
}
