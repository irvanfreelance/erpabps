import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { GoodsReceiptsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Penerimaan Barang (GRN)" };

export default async function GoodsReceiptsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT gr.id, gr.doc_no, po.doc_no as po_no, sb.name as bin_name,
           gr.status, gr.hpp_method, gr.freight_cost::numeric,
           to_char(gr.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           COALESCE(SUM(grl.goods_value), 0)::numeric as goods_total,
           COALESCE(SUM(grl.all_in_value), 0)::numeric as all_in_total
    FROM goods_receipts gr
    JOIN purchase_orders po ON gr.order_id = po.id
    JOIN stock_bins sb ON gr.bin_id = sb.id
    LEFT JOIN goods_receipt_lines grl ON gr.id = grl.receipt_id
    GROUP BY gr.id, gr.doc_no, po.doc_no, sb.name, gr.status, gr.hpp_method, gr.freight_cost, gr.posted_at
    ORDER BY gr.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Penerimaan Barang (GRN) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Barang tiba di gudang pusat dengan perhitungan HPP all-in termasuk alokasi ongkir</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <GoodsReceiptsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

