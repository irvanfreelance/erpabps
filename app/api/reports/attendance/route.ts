import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("reports.attendance", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const rows = await sql`
    SELECT e.full_name, COUNT(a.id)::int AS days, COALESCE(SUM(a.late_minutes),0)::int AS late_minutes
    FROM employees e
    LEFT JOIN attendances a ON a.employee_id = e.id
    WHERE e.deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
    GROUP BY e.full_name
    ORDER BY e.full_name
  `;
  return NextResponse.json(jsonSafe({ rows }));
}
