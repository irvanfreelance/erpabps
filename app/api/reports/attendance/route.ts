import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";
import { getWibParts } from "@/lib/utils/date-wib";

export async function GET(req?: Request) {
  const g = await guard("reports.attendance", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);

  const wib = getWibParts();
  const defaultFrom = `${wib.dateStr.slice(0, 7)}-01`;
  const defaultTo = wib.dateStr;

  const url = req ? new URL(req.url) : null;
  const from = url?.searchParams.get("from") || defaultFrom;
  const to = url?.searchParams.get("to") || defaultTo;

  const recap = await sql`
    SELECT
      e.id,
      e.full_name,
      e.employee_number,
      COUNT(DISTINCT a.id)::int AS days_present,
      COUNT(DISTINCT CASE WHEN COALESCE(a.late_minutes, 0) > 0 THEN a.id END)::int AS late_count,
      COALESCE(SUM(a.late_minutes), 0)::int AS late_minutes,
      (
        SELECT COUNT(*)::int FROM overtime_requests o
        WHERE o.employee_id = e.id AND o.status = 'approved'
          AND o.overtime_date BETWEEN ${from}::date AND ${to}::date
      ) AS overtime_count,
      (
        SELECT COALESCE(SUM(o.payable_hours), 0)::numeric(10,2) FROM overtime_requests o
        WHERE o.employee_id = e.id AND o.status = 'approved'
          AND o.overtime_date BETWEEN ${from}::date AND ${to}::date
      ) AS overtime_hours,
      (
        SELECT COUNT(*)::int FROM leave_requests l
        WHERE l.employee_id = e.id AND l.status = 'approved'
          AND l.start_date <= ${to}::date AND l.end_date >= ${from}::date
      ) AS leave_count
    FROM employees e
    LEFT JOIN attendances a ON a.employee_id = e.id
      AND a.attendance_date BETWEEN ${from}::date AND ${to}::date
    WHERE e.deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
    GROUP BY e.id, e.full_name, e.employee_number
    ORDER BY e.full_name
  `;

  const raw = await sql`
    SELECT
      a.id,
      a.attendance_date,
      a.employee_id,
      e.full_name,
      e.employee_number,
      a.clock_in_at,
      a.clock_out_at,
      COALESCE(a.late_minutes, 0)::int AS late_minutes,
      COALESCE(a.payable_minutes, 0)::int AS payable_minutes,
      a.status
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    WHERE e.deleted_at IS NULL
      AND a.attendance_date BETWEEN ${from}::date AND ${to}::date
      AND (${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[]))
    ORDER BY a.attendance_date DESC, e.full_name ASC
  `;

  return NextResponse.json(jsonSafe({ from, to, recap, raw }));
}
