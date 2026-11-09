import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
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
    <StockTablePage
      title="Kategori Barang"
      subtitle="Klasifikasi kelompok bahan baku mentah dan barang olahan setengah jadi"
      rows={jsonSafe(rows)}
      columns={[
        { key: "code", label: "Kode Kategori" },
        { key: "name", label: "Nama Kategori" },
        { key: "item_count", label: "Jumlah Barang Terdaftar", numeric: true },
      ]}
    />
  );
}

