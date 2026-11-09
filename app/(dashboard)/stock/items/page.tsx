import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Katalog Barang — ABPS Stock" };

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
    <StockTablePage
      title="Katalog Barang & Bahan"
      subtitle="Daftar master bahan mentah, barang setengah jadi olahan (ungkep), dan produk jadi"
      rows={jsonSafe(rows)}
      columns={[
        { key: "sku", label: "SKU / Kode" },
        { key: "name", label: "Nama Barang" },
        { key: "category_name", label: "Kategori" },
        { key: "item_kind", label: "Jenis", render: (r) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-700">
            {r.item_kind}
          </span>
        )},
        { key: "uom_code", label: "Satuan Ukur", render: (r) => `${r.uom_code} (${r.uom_name})` },
        { key: "is_stocked", label: "Dicatat Stok", render: (r) => r.is_stocked ? "Ya" : "Tidak" },
      ]}
    />
  );
}

