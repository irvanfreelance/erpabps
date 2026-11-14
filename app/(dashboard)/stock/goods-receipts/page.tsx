import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { GoodsReceiptsManager } from "@/components/stock/managers/goods-receipts-manager";
import { PostForm } from "@/components/stock/post-form";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Penerimaan Barang (GRN)" };

export default async function GoodsReceiptsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, orders, bins, items] = await Promise.all([
    sql`
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
  `,
    sql`
      SELECT po.id::text, po.doc_no || ' — ' || sp.name AS label,
        (SELECT json_agg(json_build_object(
          'item_id', pol.item_id::text,
          'qty', trim(to_char(GREATEST(pol.qty - COALESCE(got.qty, 0), 0), 'FM999999990.999999')),
          'unit_price', COALESCE(pol.price_hint, 0)::text
        ))
        FROM purchase_order_lines pol
        LEFT JOIN LATERAL (
          SELECT SUM(grl.qty) AS qty
          FROM goods_receipt_lines grl
          JOIN goods_receipts gr ON gr.id = grl.receipt_id
          WHERE gr.order_id = po.id AND gr.status = 'posted' AND grl.item_id = pol.item_id
            AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id)
        ) got ON TRUE
        WHERE pol.order_id = po.id) AS lines
      FROM purchase_orders po
      JOIN stock_parties sp ON sp.id = po.vendor_id
      WHERE po.status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'purchase_order' AND r.source_id = po.id)
      ORDER BY po.id DESC
    `,
    sql`SELECT id::text, name AS label FROM stock_bins WHERE is_receiving = TRUE AND deleted_at IS NULL ORDER BY name`,
    sql`SELECT id::text, sku || ' — ' || name AS label FROM stock_items WHERE deleted_at IS NULL ORDER BY name`,
  ]);
  const orderRows = jsonSafe(orders) as Array<{ id: string; label: string; lines: Array<{ item_id: string; qty: string; unit_price: string }> | null }>;
  const presets: Record<string, Array<{ item_id: string; qty: string; unit_price?: string }>> = {};
  for (const order of orderRows) {
    presets[order.id] = (order.lines ?? [])
      .filter((line) => Number(line.qty) > 0)
      .map((line) => ({ item_id: String(line.item_id), qty: String(line.qty), unit_price: String(line.unit_price ?? "") }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Penerimaan Barang (GRN) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Bukti terima barang dari vendor dan alokasi HPP all-in (harga beli + ongkir all-in)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PostForm
          title="Buat & Posting GRN"
          docPrefix="GRN"
          endpoint="/api/stock/goods-receipts"
          hint="Posting penerimaan menambah persediaan dan HPP all-in. Hutang dibuat terpisah di tagihan vendor."
          items={jsonSafe(items) as { id: string; label: string }[]}
          lineMode="qty-price"
          presets={{ field: "order_id", map: presets }}
          fields={[
            { name: "doc_no", label: "Nomor GRN", kind: "text" },
            { name: "order_id", label: "Pesanan beli", kind: "select", options: orderRows.map((o) => ({ id: o.id, label: o.label })) },
            { name: "bin_id", label: "Bin penerimaan", kind: "select", options: jsonSafe(bins) as { id: string; label: string }[] },
            { name: "freight_cost", label: "Ongkir", kind: "number", required: false },
            { name: "other_cost", label: "Biaya lain", kind: "number", required: false },
          ]}
        />
        <GoodsReceiptsManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
