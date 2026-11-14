import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { GoodsReceiptsManager } from "@/components/stock/managers/goods-receipts-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Penerimaan Barang (GRN)" };

export default async function GoodsReceiptsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT gr.id, gr.doc_no, po.doc_no as po_no,
           bin.name as bin_name, gr.status,
           gr.freight_cost::numeric, gr.other_cost::numeric,
           to_char(gr.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           (SELECT json_agg(json_build_object(
             'id', l.id,
             'item_name', si.name,
             'sku', si.sku,
             'qty', l.qty::numeric,
             'unit_cost', l.unit_cost::numeric,
             'goods_value', l.goods_value::numeric,
             'all_in_value', l.all_in_value::numeric
           )) FROM goods_receipt_lines l JOIN stock_items si ON l.item_id = si.id WHERE l.receipt_id = gr.id) as lines
    FROM goods_receipts gr
    LEFT JOIN purchase_orders po ON gr.order_id = po.id
    LEFT JOIN stock_bins bin ON gr.bin_id = bin.id
    ORDER BY gr.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Penerimaan Barang (GRN) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Bukti terima barang dari vendor dan alokasi HPP all-in (harga beli + ongkir all-in)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <GoodsReceiptsManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
