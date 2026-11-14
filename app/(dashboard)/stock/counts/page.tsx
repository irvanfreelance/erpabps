import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockCountsManager } from "@/components/stock/managers/stock-counts-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Stock Opname" };

export default async function StockCountsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sc.id, sc.doc_no, bin.name as bin_name,
           sc.status, to_char(sc.counted_on, 'YYYY-MM-DD') as counted_on,
           u.nama as creator_name,
           (SELECT json_agg(json_build_object(
             'id', cl.id,
             'item_name', si.name,
             'sku', si.sku,
             'qty_system', cl.qty_system::numeric,
             'qty_count', cl.qty_count::numeric,
             'variance', cl.variance::numeric
           )) FROM stock_count_lines cl JOIN stock_items si ON cl.item_id = si.id WHERE cl.count_id = sc.id) as lines
    FROM stock_counts sc
    LEFT JOIN stock_bins bin ON sc.bin_id = bin.id
    LEFT JOIN users u ON sc.created_by = u.id
    ORDER BY sc.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Stock Opname Fisik ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Penghitungan fisik berkala di gudang dan freezer untuk penyesuaian selisih stok</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockCountsManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
