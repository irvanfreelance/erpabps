import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate } from "@/lib/utils/format";

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
    <StockTablePage
      title="Order Penjualan (Sales Orders)"
      subtitle="Pesanan pembelian dari kanal Outlet Internal, Outlet Pihak Ketiga (Mitra), dan Catering"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. SO" },
        { key: "party_name", label: "Pihak Pemesan" },
        { key: "party_kind", label: "Kanal", render: (r) => <span className="uppercase text-xs font-semibold">{r.party_kind}</span> },
        { key: "item_count", label: "Item Dipesan", numeric: true },
        { key: "ordered_on", label: "Tanggal Pesan", render: (r) => fmtDate(r.ordered_on) },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Petugas" },
      ]}
    />
  );
}

