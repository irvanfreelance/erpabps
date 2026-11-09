import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { BomsManager } from "@/components/stock/managers/boms-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Resep & Komposisi (BOM)" };

  export default async function StockBomsPage() {
    const session = await getServerSession();
    if (!session) redirect("/login");
    const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
    if (!isSuperadmin) redirect("/employees");

    const sql = getDb();
    const [rows, outputItems, ingredientItems] = await Promise.all([
      sql`
      SELECT bom.id, bom.output_qty::numeric,
             si.name as output_item_name,
             to_char(bom.effective_from, 'YYYY-MM-DD') as effective_from,
             (SELECT json_agg(json_build_object(
               'id', bl.id,
               'item_id', bl.item_id,
               'item_name', ing.name,
               'sku', ing.sku,
               'qty', bl.qty::numeric
             )) FROM stock_bom_lines bl JOIN stock_items ing ON bl.item_id = ing.id WHERE bl.bom_id = bom.id) as lines
      FROM stock_boms bom
      JOIN stock_items si ON bom.output_item_id = si.id
      ORDER BY bom.id DESC
    `,
      sql`SELECT id, name, sku FROM stock_items WHERE item_kind IN ('semi_finished', 'finished_good') AND deleted_at IS NULL ORDER BY name ASC`,
      sql`SELECT id, name, sku FROM stock_items WHERE deleted_at IS NULL ORDER BY name ASC`,
    ]);

    return (
      <div className="space-y-4">
        <div>
          <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
            Resep & Komposisi Produksi (BOM) ({jsonSafe(rows).length})
          </h1>
          <p className="text-xs text-gray-500 m-0">Bill of Materials untuk kalkulasi HPP otomatis (misal: 10 kg Ayam Ungkep = 12 kg Ayam + 0.4 kg Bumbu)</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
          <BomsManager
            rows={jsonSafe(rows) as never}
            outputItems={jsonSafe(outputItems) as never}
            ingredientItems={jsonSafe(ingredientItems) as never}
          />
        </div>
      </div>
    );
  }
