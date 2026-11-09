import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Pesanan Beli (PO) — ABPS Stock" };

export default async function PurchaseOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT po.id, po.doc_no, pr.doc_no as request_no, sp.name as vendor_name,
           po.status, po.source_unit, u.nama as creator_name,
           to_char(po.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           COUNT(pol.id)::int as item_count
    FROM purchase_orders po
    JOIN stock_parties sp ON po.vendor_id = sp.id
    JOIN users u ON po.created_by = u.id
    LEFT JOIN purchase_requests pr ON po.request_id = pr.id
    LEFT JOIN purchase_order_lines pol ON po.id = pol.order_id
    GROUP BY po.id, po.doc_no, pr.doc_no, sp.name, po.status, po.source_unit, u.nama, po.posted_at
    ORDER BY po.id DESC
  `;

  return (
    <StockTablePage
      title="Pesanan Beli (Purchase Order)"
      subtitle="Pesanan pembelian bahan baku ke vendor rekanan oleh tim Purchasing"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. PO" },
        { key: "request_no", label: "Ref Request", render: (r) => r.request_no || "-" },
        { key: "vendor_name", label: "Vendor" },
        { key: "item_count", label: "Jumlah Item", numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Purchasing Staff" },
        { key: "posted_at", label: "Waktu Posting" },
      ]}
    />
  );
}

