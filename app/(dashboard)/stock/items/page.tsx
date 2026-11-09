import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ItemsManager } from "@/components/stock/managers/items-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Master Barang" };

export default async function StockItemsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, categories, uoms] = await Promise.all([
    sql`
      SELECT si.id, si.sku, si.name, si.item_kind,
             si.category_id, c.name as category_name,
             si.uom_id, su.code as uom_code,
             si.is_stocked
      FROM stock_items si
      JOIN stock_item_categories c ON si.category_id = c.id
      JOIN stock_uoms su ON si.uom_id = su.id
      WHERE si.deleted_at IS NULL
      ORDER BY si.sku ASC
    `,
    sql`SELECT id, name FROM stock_item_categories WHERE deleted_at IS NULL ORDER BY name ASC`,
    sql`SELECT id, code, name FROM stock_uoms WHERE deleted_at IS NULL ORDER BY code ASC`,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Master Barang & Bahan ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Katalog bahan baku mentah (Ayam, Bumbu) dan hasil olahan dapur (Ayam Ungkep)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <ItemsManager
          rows={jsonSafe(rows) as never}
          categories={jsonSafe(categories) as never}
          uoms={jsonSafe(uoms) as never}
        />
      </div>
    </div>
  );
}
