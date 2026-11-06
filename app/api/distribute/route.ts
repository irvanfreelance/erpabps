import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";

export async function POST(req: Request) {
  const g = await guard("donors", "assign");
  if (g.error) return g.error;
  const { donorIds, picIds } = (await req.json()) as { donorIds: string[]; picIds: string[] };
  if (!donorIds?.length || !picIds?.length) {
    return NextResponse.json({ error: "donorIds and picIds required" }, { status: 400 });
  }
  const sql = getDb();
  const batch = await sql`
    INSERT INTO distribute_batches (total_donors, pic_count, config_json, status, dijalankan_oleh, completed_at)
    VALUES (${donorIds.length}, ${picIds.length}, ${JSON.stringify({ picIds })}::jsonb, 'done', ${g.session!.user.id}, now())
    RETURNING id
  `;
  for (let i = 0; i < donorIds.length; i++) {
    const id = donorIds[i];
    const assignedTo = picIds[i % picIds.length];
    const current = await sql`SELECT assigned_to FROM donors WHERE id = ${id}`;
    const from = current[0] ? String((current[0] as { assigned_to: string | null }).assigned_to) : null;
    await sql`
      UPDATE donors SET assigned_to = ${assignedTo}, assigned_at = now(),
        follow_up_status = COALESCE(follow_up_status, 'in_progress')
      WHERE id = ${id}
    `;
    await sql`
      INSERT INTO donor_assignment_history (donor_id, assigned_from, assigned_to, assigned_by, reason)
      VALUES (${id}, ${from}, ${assignedTo}, ${g.session!.user.id}, 'bulk assign')
    `;
    await sql`SELECT fn_rebuild_search_index(${id}::bigint)`;
  }
  await logAudit({ userId: g.session!.user.id, action: "assign", entityType: "distribute_batch", entityId: String((batch[0] as { id: string }).id) });
  return NextResponse.json(batch[0]);
}
