import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockItemsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Katalog Barang" };

export default async function StockItemsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT si.id, si.sku, si.name, si.item_kind, si.is_stocked,
           c.name as category_name, su.code as uom_code, su.name as uom_name
    FROM stock_items si
    JOIN stock_item_categories c ON si.category_id = c.id
    JOIN stock_uoms su ON si.uom_id = su.id
    WHERE si.deleted_at IS NULL
    ORDER BY si.sku
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Katalog Barang & Bahan ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Daftar master bahan mentah, barang setengah jadi olahan (ungkep), dan produk jadi</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockItemsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

