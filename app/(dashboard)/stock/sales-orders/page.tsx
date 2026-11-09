import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { SalesOrdersManager } from "@/components/stock/managers/sales-orders-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Order Penjualan" };

export default async function SalesOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, parties, availableItems] = await Promise.all([
    sql`
      SELECT so.id, so.doc_no, p.name as party_name, so.status,
             to_char(so.ordered_on, 'YYYY-MM-DD') as ordered_on,
             u.nama as creator_name,
             (SELECT json_agg(json_build_object(
               'id', l.id,
               'item_name', si.name,
               'sku', si.sku,
               'qty', l.qty::numeric
             )) FROM sales_order_lines l JOIN stock_items si ON l.item_id = si.id WHERE l.order_id = so.id) as lines
      FROM sales_orders so
      JOIN stock_parties p ON so.party_id = p.id
      LEFT JOIN users u ON so.created_by = u.id
      ORDER BY so.id DESC
    `,
    sql`SELECT id, name FROM stock_parties WHERE party_kind IN ('internal_outlet', 'third_party_outlet', 'catering') AND deleted_at IS NULL ORDER BY name ASC`,
    sql`SELECT id, name, sku FROM stock_items WHERE item_kind IN ('semi_finished', 'finished_good') AND deleted_at IS NULL ORDER BY name ASC`,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Order Penjualan (SO) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pesanan barang dari outlet cabang internal, mitra pihak ke-3, dan pesanan catering</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <SalesOrdersManager
          rows={jsonSafe(rows) as never}
          parties={jsonSafe(parties) as never}
          availableItems={jsonSafe(availableItems) as never}
        />
      </div>
    </div>
  );
}
