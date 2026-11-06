import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET() {
  const g = await guard("dashboard", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const [totals] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS donors,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND status_kontak = 'aktif')::int AS aktif,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND assigned_to IS NOT NULL)::int AS assigned,
      COALESCE(SUM(total_donation_lifetime) FILTER (WHERE deleted_at IS NULL), 0) AS lifetime
    FROM donors
  `;
  const rfm = await sql`
    SELECT COALESCE(segmen_rfm, 'unscored') AS segmen, COUNT(*)::int AS n
    FROM donors WHERE deleted_at IS NULL
    GROUP BY 1 ORDER BY n DESC
  `;
  const trend = await sql`
    SELECT bulan_program AS bulan, COALESCE(SUM(nominal),0) AS total, COUNT(*)::int AS n
    FROM transactions WHERE status = 'paid'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 12
  `;
  const workload = await sql`
    SELECT u.nama, COUNT(d.id)::int AS n
    FROM users u
    LEFT JOIN donors d ON d.assigned_to = u.id AND d.deleted_at IS NULL
    WHERE u.role IN ('tim_blast','supervisor') AND u.deleted_at IS NULL
    GROUP BY u.id, u.nama
    ORDER BY n DESC
  `;
  const byProgram = await sql`
    SELECT p.nama, COALESCE(SUM(t.nominal) FILTER (WHERE t.status = 'paid'), 0) AS total,
           COUNT(t.id) FILTER (WHERE t.status = 'paid')::int AS n
    FROM programs p
    LEFT JOIN transactions t ON t.program_id = p.id
    GROUP BY p.id, p.nama
    HAVING COUNT(t.id) FILTER (WHERE t.status = 'paid') > 0
    ORDER BY total DESC
    LIMIT 8
  `;
  const byStatus = await sql`
    SELECT status_kontak AS name, COUNT(*)::int AS value
    FROM donors WHERE deleted_at IS NULL
    GROUP BY 1 ORDER BY value DESC
  `;
  const byFollow = await sql`
    SELECT COALESCE(follow_up_status, 'belum') AS name, COUNT(*)::int AS n
    FROM donors
    WHERE deleted_at IS NULL AND assigned_to IS NOT NULL
    GROUP BY 1 ORDER BY n DESC
  `;
  return NextResponse.json(
    jsonSafe({ totals: totals as Record<string, unknown>, rfm, trend, workload, byProgram, byStatus, byFollow }),
  );
}
