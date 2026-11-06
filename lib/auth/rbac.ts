import type { Role } from "@/types/auth";

type Action = "read" | "create" | "update" | "delete" | "assign" | "import" | "export" | "config";

const matrix: Record<Role, Action[] | "*"> = {
  admin: "*",
  supervisor: ["read", "create", "update", "assign", "import", "export"],
  data_analyst: ["read", "create", "update", "import", "export"],
  tim_blast: ["read", "create", "update"],
  read_only: ["read"],
};

export function checkPermission(role: Role, _resource: string, action: Action) {
  const allowed = matrix[role];
  if (allowed === "*") return true;
  if (role === "tim_blast" && !["worklist", "prospect_notes", "donors"].includes(_resource) && action !== "read") {
    return false;
  }
  return allowed.includes(action);
}
