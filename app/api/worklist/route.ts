import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET(req: Request) {
  const g = await guard("worklist", "read");
  if (g.error) return g.error;
  const assignedTo = new URL(req.url).searchParams.get("assignedTo");
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM v_donor_worklist
    WHERE (${assignedTo ?? null}::text IS NULL OR assigned_to = ${assignedTo ?? null}::bigint)
    ORDER BY priority_score DESC, follow_up_due_date ASC NULLS LAST
    LIMIT 200
  `;
  return NextResponse.json({ rows: jsonSafe(rows) });
}
