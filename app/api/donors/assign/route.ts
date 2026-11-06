import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { assignSchema } from "@/lib/validators/donor";

export async function POST(req: Request) {
  const g = await guard("donors", "assign");
  if (g.error) return g.error;
  const parsed = assignSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  for (const id of parsed.data.donorIds) {
    const current = await sql`SELECT assigned_to FROM donors WHERE id = ${id}`;
    const from = current[0] ? String((current[0] as { assigned_to: string | null }).assigned_to) : null;
    await sql`
      UPDATE donors SET assigned_to = ${parsed.data.assignedTo}, assigned_at = now(),
        follow_up_status = COALESCE(follow_up_status, 'in_progress')
      WHERE id = ${id}
    `;
    await sql`
      INSERT INTO donor_assignment_history (donor_id, assigned_from, assigned_to, assigned_by, reason)
      VALUES (${id}, ${from}, ${parsed.data.assignedTo}, ${g.session!.user.id}, 'bulk assign')
    `;
    await sql`SELECT fn_rebuild_search_index(${id}::bigint)`;
  }
  await logAudit({ userId: g.session!.user.id, action: "assign", entityType: "donor", valueAfter: parsed.data });
  return NextResponse.json({ success: true });
}
