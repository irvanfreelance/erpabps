import type { SqlClient } from "@/lib/db";

export type SettingScope = {
  employeeId?: string | null;
  positionId?: string | null;
  locationId?: string | null;
  payGroupId?: string | null;
};

const ORDER = ["employee", "position", "location", "pay_group", "org"] as const;

export async function resolveSetting(
  sql: SqlClient,
  key: string,
  asOf: string,
  scope: SettingScope,
): Promise<{ key: string; value: unknown; scope_type: string; source_ref: string | null }> {
  const defRows = await sql`
    SELECT id, key, default_value FROM setting_definitions WHERE key = ${key} LIMIT 1
  `;
  const def = defRows[0] as { id: string; key: string; default_value: unknown } | undefined;
  if (!def) {
    return { key, value: null, scope_type: "missing", source_ref: null };
  }

  const scopes: { type: string; id: string | null }[] = [
    { type: "employee", id: scope.employeeId ?? null },
    { type: "position", id: scope.positionId ?? null },
    { type: "location", id: scope.locationId ?? null },
    { type: "pay_group", id: scope.payGroupId ?? null },
    { type: "org", id: null },
  ];

  for (const s of scopes) {
    if (s.type !== "org" && !s.id) continue;
    const rows = await sql`
      SELECT value, source_ref, scope_type
      FROM setting_values
      WHERE definition_id = ${def.id}::bigint
        AND scope_type = ${s.type}
        AND (${s.id}::bigint IS NULL OR scope_id = ${s.id}::bigint)
        AND status = 'active'
        AND effective_from <= ${asOf}::date
        AND (effective_to IS NULL OR effective_to > ${asOf}::date)
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    if (rows[0]) {
      const row = rows[0] as { value: unknown; source_ref: string; scope_type: string };
      return { key, value: unwrap(row.value), scope_type: row.scope_type, source_ref: row.source_ref };
    }
  }

  return { key, value: unwrap(def.default_value), scope_type: "definition", source_ref: null };
}

function unwrap(raw: unknown) {
  if (raw && typeof raw === "object" && "v" in (raw as object)) return (raw as { v: unknown }).v;
  return raw;
}

export async function resolvePayrollSettings(
  sql: SqlClient,
  asOf: string,
  scope: SettingScope,
) {
  const keys = [
    "attendance.late_deduction_mode",
    "weekly.total_hours_basis",
    "period.monthly_payday_day",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = (await resolveSetting(sql, key, asOf, scope)).value;
  }
  void ORDER;
  return out;
}
