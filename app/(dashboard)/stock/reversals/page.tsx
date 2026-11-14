import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockReversalsTable } from "@/components/stock/stock-tables";
import { PostForm } from "@/components/stock/post-form";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Koreksi / Pembalik Stok" };

export default async function StockReversalsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, sources] = await Promise.all([
    sql`
    SELECT sr.id, sr.doc_no, sr.source_type, sr.source_id, sr.reason,
           u.nama as creator_name,
           to_char(sr.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at
    FROM stock_reversals sr
    JOIN users u ON sr.created_by = u.id
    ORDER BY sr.id DESC
  `,
    sql`
      SELECT 'purchase_order:' || id::text AS id, 'PO ' || doc_no AS label FROM purchase_orders WHERE status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'purchase_order' AND r.source_id = purchase_orders.id)
      UNION ALL
      SELECT 'goods_receipt:' || id::text, 'GRN ' || doc_no FROM goods_receipts WHERE status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'goods_receipt' AND r.source_id = goods_receipts.id)
      UNION ALL
      SELECT 'production_order:' || id::text, 'MO ' || doc_no FROM production_orders WHERE status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'production_order' AND r.source_id = production_orders.id)
      UNION ALL
      SELECT 'shipment:' || id::text, 'DO ' || doc_no FROM shipments WHERE status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'shipment' AND r.source_id = shipments.id)
      UNION ALL
      SELECT 'sales_invoice:' || id::text, 'INV ' || doc_no FROM sales_invoices WHERE status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'sales_invoice' AND r.source_id = sales_invoices.id)
      UNION ALL
      SELECT 'vendor_payment:' || id::text, 'PAY ' || doc_no FROM vendor_payments WHERE status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'vendor_payment' AND r.source_id = vendor_payments.id)
      UNION ALL
      SELECT 'stock_count:' || id::text, 'OPN ' || doc_no FROM stock_counts WHERE status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'stock_count' AND r.source_id = stock_counts.id)
      ORDER BY 2 DESC
    `,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Koreksi & Dokumen Pembalik ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Dokumen posted tidak diubah langsung melainkan diperbaiki lewat pembalik yang diaudit</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PostForm
          title="Buat Pembalik"
          docPrefix="REV"
          endpoint="/api/stock/reversals"
          hint="Dokumen posted tidak diubah. Pembalik menambah mutasi lawan dan jejak audit."
          fields={[
            { name: "doc_no", label: "Nomor pembalik", kind: "text" },
            { name: "source", label: "Dokumen asal", kind: "select", options: jsonSafe(sources) as { id: string; label: string }[] },
            { name: "reason", label: "Alasan", kind: "textarea" },
          ]}
        />
        <StockReversalsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

