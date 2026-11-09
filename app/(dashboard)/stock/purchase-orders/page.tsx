import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PurchaseOrdersTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Pesanan Beli (PO)" };

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
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Pesanan Beli (PO) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pesanan pembelian bahan baku ke vendor rekanan oleh tim Purchasing</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PurchaseOrdersTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

