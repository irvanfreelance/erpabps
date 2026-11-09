import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { CategoriesManager } from "@/components/stock/managers/categories-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Kategori Barang" };

export default async function StockCategoriesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT c.id, c.code, c.name,
           COUNT(si.id)::int as item_count
    FROM stock_item_categories c
    LEFT JOIN stock_items si ON c.id = si.category_id AND si.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id, c.code, c.name
    ORDER BY c.code ASC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Kategori Barang & Bahan ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pengelompokan barang untuk klasifikasi persediaan, HPP, dan laporan</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <CategoriesManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
