import type { Role } from "@/types/auth";

export type Action = "read" | "create" | "update" | "approve";

const ALL_READ: Action[] = ["read"];
const RU: Action[] = ["read", "update"];
const RCU: Action[] = ["read", "create", "update"];
const RCUA: Action[] = ["read", "create", "update", "approve"];
const RC: Action[] = ["read", "create"];
const RA: Action[] = ["read", "approve"];

const byRole: Record<Role, Record<string, Action[]>> = {
  superadmin: {},
  superordinat: {
    "attendances.clock": RCU,
    attendances: ALL_READ,
    schedules: RCU,
    "shift-swaps": RCUA,
    leaves: RCUA,
    overtimes: RCUA,
    employees: RU,
    payslips: ALL_READ,
    "cash-advances": RC,
    "org-profile": ALL_READ,
    app_config: ALL_READ,
  },
  subordinat: {
    "attendances.clock": RCU,
    attendances: ALL_READ,
    schedules: ALL_READ,
    "shift-swaps": RC,
    leaves: RC,
    overtimes: ["read", "create"],
    employees: RU,
    payslips: ALL_READ,
    "cash-advances": RC,
    "org-profile": ALL_READ,
    app_config: ALL_READ,
  },
};

export function checkPermission(role: Role, resource: string, action: Action) {
  if (role === "superadmin") return true;
  const allowed = byRole[role][resource];
  if (!allowed) return false;
  return allowed.includes(action);
}
