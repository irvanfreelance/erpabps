import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  key: z.string(),
  scopeType: z.enum(["org", "pay_group", "location", "position", "employee"]),
  scopeId: z.string().nullable().optional(),
  value: z.unknown(),
  effectiveFrom: z.string(),
  sourceRef: z.string().min(1),
  reason: z.string().min(3),
});

export async function GET() {
  const g = await guard("settings.rules", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const defs = await sql`SELECT id, key, category, label, value_type, default_value, allowed_scopes, is_locked FROM setting_definitions ORDER BY key`;
  const values = await sql`
    SELECT v.id, d.key, v.scope_type, v.scope_id, v.value, v.effective_from, v.effective_to, v.status, v.source_ref, v.reason
    FROM setting_values v
    JOIN setting_definitions d ON d.id = v.definition_id
    WHERE v.status = 'active'
    ORDER BY d.key, v.effective_from DESC
  `;
  return NextResponse.json(jsonSafe({ definitions: defs, values }));
}

export async function POST(req: Request) {
  const g = await guard("settings.rules", "update");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  const def = await sql`SELECT id, is_locked FROM setting_definitions WHERE key = ${parsed.data.key}`;
  if (!def[0]) return NextResponse.json({ error: "Kunci tidak dikenal" }, { status: 404 });
  if ((def[0] as { is_locked: boolean }).is_locked) {
    return NextResponse.json({ error: "Kunci terkunci" }, { status: 400 });
  }
  const payload = JSON.stringify({ v: parsed.data.value });
  const rows = await sql`
    INSERT INTO setting_values (
      definition_id, scope_type, scope_id, value, effective_from, status, source_ref, reason, created_by
    ) VALUES (
      ${(def[0] as { id: string }).id}::bigint, ${parsed.data.scopeType}, ${parsed.data.scopeId ?? null}::bigint,
      ${payload}::jsonb, ${parsed.data.effectiveFrom}::date, 'active', ${parsed.data.sourceRef}, ${parsed.data.reason},
      ${actor}::bigint
    )
    RETURNING id
  `;
  await sql`
    INSERT INTO setting_audit_logs (definition_key, action, scope_type, scope_id, new_value, source_ref, reason, actor_id)
    VALUES (
      ${parsed.data.key}, 'create', ${parsed.data.scopeType}, ${parsed.data.scopeId ?? null}::bigint,
      ${payload}::jsonb, ${parsed.data.sourceRef}, ${parsed.data.reason}, ${actor}::bigint
    )
  `;
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "setting_value", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
