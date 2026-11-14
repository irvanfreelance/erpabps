import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ProductionOrdersManager } from "@/components/stock/managers/production-orders-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Perintah Produksi" };

export default async function ProductionOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT mo.id, mo.doc_no, mo.output_qty::numeric,
           mo.total_cost::numeric, mo.status,
           si.name as output_item_name,
           bin.name as output_bin_name,
           (SELECT json_agg(json_build_object(
             'id', bl.id,
             'item_name', ing.name,
             'sku', ing.sku,
             'qty', bl.qty::numeric
           )) FROM stock_bom_lines bl JOIN stock_items ing ON bl.item_id = ing.id WHERE bl.bom_id = mo.bom_id) as ingredients
    FROM production_orders mo
    JOIN stock_boms bom ON mo.bom_id = bom.id
    JOIN stock_items si ON bom.output_item_id = si.id
    LEFT JOIN stock_bins bin ON mo.output_bin_id = bin.id
    ORDER BY mo.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Perintah Produksi (Ungkep) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pengolahan bahan mentah menjadi ayam ungkep dan transfer otomatis ke freezer dengan HPP terbentuk</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <ProductionOrdersManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
