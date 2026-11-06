import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

const decide = z.object({ id: z.string(), decision: z.enum(["approved", "rejected"]), note: z.string().optional() });

export async function GET() {
  const g = await guard("approvals", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const rows = await sql`
    SELECT r.id, r.target_type, r.target_id, r.status, r.created_at, u.nama AS requested_by_name
    FROM approval_requests r
    JOIN users u ON u.id = r.requested_by
    ORDER BY r.created_at DESC
    LIMIT 200
  `;
  return NextResponse.json(jsonSafe({ rows }));
}

export async function POST(req: Request) {
  const g = await guard("approvals", "approve");
  if (g.error) return g.error;
  const parsed = decide.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  if (parsed.data.decision === "approved") {
    const sqlCheck = getDb();
    const reqRow = await sqlCheck`SELECT requested_by FROM approval_requests WHERE id = ${parsed.data.id}::bigint`;
    const requestedBy = String((reqRow[0] as { requested_by: string } | undefined)?.requested_by ?? "");
    if (requestedBy === g.session!.user.id) {
      return NextResponse.json({ error: "Tidak ada self-approval" }, { status: 400 });
    }
  }
  const sql = getDb();
  await sql`
    INSERT INTO approval_decisions (request_id, actor_id, decision, note)
    VALUES (${parsed.data.id}::bigint, ${g.session!.user.id}::bigint, ${parsed.data.decision}, ${parsed.data.note ?? null})
    ON CONFLICT (request_id, actor_id) DO NOTHING
  `;
  await sql`UPDATE approval_requests SET status = ${parsed.data.decision} WHERE id = ${parsed.data.id}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "approve", entityType: "approval_request", entityId: parsed.data.id });
  return NextResponse.json({ ok: true });
}
