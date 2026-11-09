import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockCountsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Stock Opname" };

export default async function StockCountsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sc.id, sc.doc_no, sb.name as bin_name,
           to_char(sc.counted_on, 'YYYY-MM-DD') as counted_on,
           sc.status, u.nama as creator_name,
           COUNT(scl.id)::int as total_lines
    FROM stock_counts sc
    JOIN stock_bins sb ON sc.bin_id = sb.id
    JOIN users u ON sc.created_by = u.id
    LEFT JOIN stock_count_lines scl ON sc.id = scl.count_id
    GROUP BY sc.id, sc.doc_no, sb.name, sc.counted_on, sc.status, u.nama
    ORDER BY sc.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Stock Opname ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pencocokan kuantitas sistem dengan fisik berkala di gudang dan freezer</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockCountsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

