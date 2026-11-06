import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { jsonSafe } from "@/lib/utils/serialize";

const schema = z.object({
  category: z.string().optional(),
  definitionKey: z.string().optional(),
  requiresApproval: z.boolean(),
  approverRoles: z.array(z.enum(["superadmin", "superordinat"])),
  minApprovers: z.number().int().min(1).max(5),
  effectiveFrom: z.string(),
  reason: z.string().min(3),
});

export async function GET() {
  const g = await guard("approvals.policies", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT id, category, scope_type, requires_approval, approver_roles, min_approvers, allow_self_approval, effective_from, status, reason
    FROM approval_policies ORDER BY id DESC
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("approvals.policies", "create");
  if (g.error) return g.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  const admins = await sql`SELECT COUNT(*)::int AS n FROM users WHERE role = 'superadmin' AND deleted_at IS NULL AND is_active = TRUE`;
  const adminCount = (admins[0] as { n: number }).n;
  if (parsed.data.requiresApproval && parsed.data.minApprovers > 1 && adminCount < 2) {
    return NextResponse.json({ error: "Kebijakan tidak bisa disetujui: superadmin kedua belum ada" }, { status: 400 });
  }
  let definitionId: string | null = null;
  if (parsed.data.definitionKey) {
    const d = await sql`SELECT id FROM setting_definitions WHERE key = ${parsed.data.definitionKey}`;
    definitionId = d[0] ? String((d[0] as { id: string }).id) : null;
  }
  const rows = await sql`
    INSERT INTO approval_policies (
      definition_id, category, requires_approval, approver_roles, min_approvers, allow_self_approval, effective_from, reason, created_by
    ) VALUES (
      ${definitionId}::bigint, ${parsed.data.category ?? null}, ${parsed.data.requiresApproval},
      ${parsed.data.approverRoles}::varchar[], ${parsed.data.minApprovers}, FALSE, ${parsed.data.effectiveFrom}::date,
      ${parsed.data.reason}, ${actor}::bigint
    )
    RETURNING id
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "approval_policy", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}
