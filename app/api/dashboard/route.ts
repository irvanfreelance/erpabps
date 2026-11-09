import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard("dashboard", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);

  // 1. Roster summary
  const roster = await sql`
    SELECT
      COUNT(*) FILTER (WHERE record_status = 'active')::int AS active,
      COUNT(*) FILTER (WHERE record_status = 'draft')::int AS draft,
      COUNT(*) FILTER (WHERE in_payroll = TRUE)::int AS in_payroll,
      COUNT(*)::int AS total
    FROM employees
    WHERE deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR id = ANY(${ids}::bigint[]))
  `;

  // 2. Presensi hari ini
  const today = await sql`
    SELECT 
      COUNT(*)::int AS present,
      COUNT(*) FILTER (WHERE late_minutes > 0)::int AS late
    FROM attendances a
    WHERE a.attendance_date = CURRENT_DATE
      AND (${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[]))
  `;

  // 3. Open runs & Pending kasbon
  const runs = await sql`
    SELECT COUNT(*)::int AS n FROM payroll_runs WHERE status IN ('draft', 'calculated', 'reviewed')
  `;
  const kasbon = await sql`
    SELECT COUNT(*)::int AS n FROM cash_advances
    WHERE screening_status = 'submitted'
      AND (${ids}::bigint[] IS NULL OR employee_id = ANY(${ids}::bigint[]))
  `;

  // 4. Distribusi Karyawan per Jabatan
  const positionDist = await sql`
    SELECT COALESCE(p.name, 'Tanpa Jabatan') as label, COUNT(e.id)::int as count
    FROM employees e
    LEFT JOIN positions p ON e.position_id = p.id
    WHERE e.deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
    GROUP BY p.name
    ORDER BY count DESC
    LIMIT 6
  `;

  // 5. Tren Kehadiran 7 Hari Terakhir
  const attendanceTrend = await sql`
    WITH days AS (
      SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS d
    )
    SELECT 
      to_char(days.d, 'DD Mon') as date_label,
      COUNT(a.id)::int as hadir,
      COUNT(a.id) FILTER (WHERE a.late_minutes > 0)::int as telat
    FROM days
    LEFT JOIN attendances a ON a.attendance_date = days.d 
      AND (${ids}::bigint[] IS NULL OR a.employee_id = ANY(${ids}::bigint[]))
    GROUP BY days.d
    ORDER BY days.d ASC
  `;

  // 6. Distribusi per Kelompok Gaji
  const payGroupDist = await sql`
    SELECT COALESCE(pg.name, 'Tanpa Kelompok') as label, COUNT(e.id)::int as count
    FROM employees e
    LEFT JOIN pay_groups pg ON e.pay_group_id = pg.id
    WHERE e.deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
    GROUP BY pg.name
    ORDER BY count DESC
  `;

  // 7. Pengeluaran Payroll Run Terakhir (menggunakan kolom yang valid di schema: period_start, period_end, net_pay)
  const lastRuns = await sql`
    SELECT 
      (to_char(pr.period_start, 'DD/MM') || ' - ' || to_char(pr.period_end, 'DD/MM')) as period_name,
      to_char(pr.created_at, 'DD/MM') as date_label,
      COALESCE(SUM(pi.net_pay), 0)::numeric as total_gaji
    FROM payroll_runs pr
    LEFT JOIN payroll_items pi ON pr.id = pi.payroll_run_id
    GROUP BY pr.id, pr.period_start, pr.period_end, pr.created_at
    ORDER BY pr.id DESC
    LIMIT 5
  `;

  return NextResponse.json(
    jsonSafe({
      roster: roster[0],
      attendancesToday: today[0],
      openRuns: (runs[0] as { n: number }).n,
      pendingKasbon: (kasbon[0] as { n: number }).n,
      charts: {
        positionDist,
        attendanceTrend,
        payGroupDist,
        lastRuns: lastRuns.reverse(),
      },
    }),
  );
}
