import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ProductionOrdersManager } from "@/components/stock/managers/production-orders-manager";
import { PostForm } from "@/components/stock/post-form";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Perintah Produksi" };

export default async function ProductionOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, boms, bins] = await Promise.all([
    sql`
    SELECT mo.id, mo.doc_no, mo.output_qty::numeric,
           mo.total_cost::numeric, mo.status,
           si.name as output_item_name,
           bin.name as output_bin_name,
           (SELECT json_agg(json_build_object(
             'id', pl.id,
             'item_name', ing.name,
             'sku', ing.sku,
             'qty', pl.qty::numeric,
             'value', pl.value::numeric
           ) ORDER BY pl.id) FROM production_lines pl JOIN stock_items ing ON pl.item_id = ing.id WHERE pl.order_id = mo.id) as ingredients
    FROM production_orders mo
    JOIN stock_boms bom ON mo.bom_id = bom.id
    JOIN stock_items si ON bom.output_item_id = si.id
    LEFT JOIN stock_bins bin ON mo.output_bin_id = bin.id
    ORDER BY mo.id DESC
  `,
    sql`
      SELECT b.id::text AS id, si.name || ' / ' || b.output_qty::text AS label
      FROM stock_boms b
      JOIN stock_items si ON si.id = b.output_item_id
      WHERE b.effective_to IS NULL OR b.effective_to > CURRENT_DATE
      ORDER BY si.name
    `,
    sql`SELECT id::text AS id, name AS label FROM stock_bins WHERE deleted_at IS NULL ORDER BY name`,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Perintah Produksi (Ungkep) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pengolahan bahan mentah menjadi ayam ungkep dan transfer otomatis ke freezer dengan HPP terbentuk</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PostForm
          title="Buat & Posting Produksi"
          docPrefix="MO"
          endpoint="/api/stock/production-orders"
          hint="Bahan dikonsumsi menurut resep pada biaya saldo saat ini. Hasil masuk ke bin tujuan dengan HPP tergulung."
          fields={[
            { name: "doc_no", label: "Nomor produksi", kind: "text" },
            { name: "bom_id", label: "Resep", kind: "select", options: jsonSafe(boms) as { id: string; label: string }[] },
            { name: "output_qty", label: "Kuantitas hasil", kind: "number", step: "0.001" },
            { name: "source_bin_id", label: "Bin bahan", kind: "select", options: jsonSafe(bins) as { id: string; label: string }[] },
            { name: "output_bin_id", label: "Bin hasil", kind: "select", options: jsonSafe(bins) as { id: string; label: string }[] },
          ]}
        />
        <ProductionOrdersManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
