import type { Role } from "@/types/auth";

type Action = "read" | "create" | "update" | "delete" | "assign" | "import" | "export" | "config";

const matrix: Record<Role, Action[] | "*"> = {
  superadmin: "*",
  superordinat: ["read", "create", "update", "assign", "import", "export"],
  subordinat: ["read", "create", "update"],
};

export function checkPermission(role: Role, _resource: string, action: Action) {
  const allowed = matrix[role];
  if (!allowed) return false;
  if (allowed === "*") return true;
  return allowed.includes(action);
}
