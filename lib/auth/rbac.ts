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
    dashboard: ALL_READ,
    "attendances.clock": RCU,
    attendances: ALL_READ,
    schedules: RCU,
    "shift-templates": ALL_READ,
    "shift-swaps": RCUA,
    employees: RCU,
    "payroll-runs": ALL_READ,
    payslips: ALL_READ,
    "cash-advances": RC,
    "bonus.monthly": ALL_READ,
    "contract-stages": ALL_READ,
    contracts: ALL_READ,
    "reports.attendance": ALL_READ,
    "reports.payroll": ALL_READ,
    master: ALL_READ,
    locations: ALL_READ,
    positions: ALL_READ,
    ranks: ALL_READ,
    "pay-groups": ALL_READ,
    "salary-components": ALL_READ,
    holidays: ALL_READ,
    approvals: RA,
    "org-profile": ALL_READ,
    app_config: ALL_READ,
  },
  subordinat: {
    dashboard: ALL_READ,
    "attendances.clock": RCU,
    attendances: ALL_READ,
    schedules: ALL_READ,
    "shift-swaps": RC,
    employees: RU,
    payslips: ALL_READ,
    "cash-advances": RC,
    "bonus.monthly": ALL_READ,
    contracts: ALL_READ,
    "reports.attendance": ALL_READ,
    "reports.payroll": ALL_READ,
    approvals: ALL_READ,
    "org-profile": ALL_READ,
    app_config: ALL_READ,
    locations: ALL_READ,
    positions: ALL_READ,
    ranks: ALL_READ,
    "pay-groups": ALL_READ,
    "salary-components": ALL_READ,
    "contract-stages": ALL_READ,
    holidays: ALL_READ,
  },
};

export function checkPermission(role: Role, resource: string, action: Action) {
  if (role === "superadmin") return true;
  const allowed = byRole[role][resource];
  if (!allowed) return false;
  return allowed.includes(action);
}
