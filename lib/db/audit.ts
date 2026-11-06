import { getDb } from "@/lib/db";

export async function logAudit(input: {
  userId?: string | null;
  donorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  fieldChanged?: string | null;
  valueBefore?: unknown;
  valueAfter?: unknown;
  source?: string;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO audit_logs (
      user_id, donor_id, action, entity_type, entity_id, field_changed,
      value_before, value_after, source
    ) VALUES (
      ${input.userId ?? null},
      ${input.donorId ?? null},
      ${input.action},
      ${input.entityType},
      ${input.entityId ?? null},
      ${input.fieldChanged ?? null},
      ${JSON.stringify(input.valueBefore ?? null)}::jsonb,
      ${JSON.stringify(input.valueAfter ?? null)}::jsonb,
      ${input.source ?? "web_app"}
    )
  `;
}
