import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PurchaseOrdersTable } from "@/components/stock/stock-tables";
import { PostForm } from "@/components/stock/post-form";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Pesanan Beli (PO)" };

export default async function PurchaseOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT po.id, po.doc_no, pr.doc_no as request_no, sp.name as vendor_name,
           po.status, po.source_unit, u.nama as creator_name,
           to_char(po.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           COUNT(pol.id)::int as item_count,
           (SELECT json_agg(json_build_object(
             'id', pol2.id,
             'item_name', si.name,
             'sku', si.sku,
             'qty', pol2.qty::numeric,
             'price_hint', pol2.price_hint::numeric
           ) ORDER BY pol2.id)
            FROM purchase_order_lines pol2
            JOIN stock_items si ON si.id = pol2.item_id
            WHERE pol2.order_id = po.id) AS lines
    FROM purchase_orders po
    JOIN stock_parties sp ON po.vendor_id = sp.id
    JOIN users u ON po.created_by = u.id
    LEFT JOIN purchase_requests pr ON po.request_id = pr.id
    LEFT JOIN purchase_order_lines pol ON po.id = pol.order_id
    GROUP BY po.id, po.doc_no, pr.doc_no, sp.name, po.status, po.source_unit, u.nama, po.posted_at
    ORDER BY po.id DESC
  `;
  const [vendors, items, requests] = await Promise.all([
    sql`SELECT id::text, name AS label FROM stock_parties WHERE party_kind = 'vendor' AND deleted_at IS NULL ORDER BY name`,
    sql`SELECT id::text, sku || ' — ' || name AS label FROM stock_items WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT id::text, doc_no AS label FROM purchase_requests WHERE status = 'posted' ORDER BY id DESC`,
  ]);
  const vendorOpts = jsonSafe(vendors) as { id: string; label: string }[];
  const itemOpts = jsonSafe(items) as { id: string; label: string }[];
  const requestOpts = jsonSafe(requests) as { id: string; label: string }[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Pesanan Beli (PO) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pesanan pembelian bahan baku ke vendor rekanan oleh tim Purchasing</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PostForm
          title="Buat & Posting PO"
          docPrefix="PO"
          endpoint="/api/stock/purchase-orders"
          hint="Pesanan posted belum menggerakkan stok. Barang masuk lewat penerimaan."
          items={itemOpts}
          lineMode="qty-price"
          fields={[
            { name: "doc_no", label: "Nomor PO", kind: "text" },
            { name: "vendor_id", label: "Vendor", kind: "select", options: vendorOpts },
            { name: "request_id", label: "Permintaan (opsional)", kind: "select", required: false, options: requestOpts, empty: "Tanpa permintaan" },
          ]}
        />
        <PurchaseOrdersTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

