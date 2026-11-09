import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { SalesOrdersTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Order Penjualan (SO)" };

export default async function SalesOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT so.id, so.doc_no, sp.name as party_name, sp.party_kind, so.status,
           to_char(so.ordered_on, 'YYYY-MM-DD') as ordered_on,
           COUNT(sol.id)::int as item_count,
           u.nama as creator_name
    FROM sales_orders so
    JOIN stock_parties sp ON so.party_id = sp.id
    JOIN users u ON so.created_by = u.id
    LEFT JOIN sales_order_lines sol ON so.id = sol.order_id
    GROUP BY so.id, so.doc_no, sp.name, sp.party_kind, so.status, so.ordered_on, u.nama
    ORDER BY so.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Order Penjualan (Sales Orders) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pesanan pembelian dari kanal Outlet Internal, Outlet Pihak Ketiga (Mitra), dan Catering</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <SalesOrdersTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

