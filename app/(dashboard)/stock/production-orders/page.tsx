import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ProductionOrdersTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Perintah Produksi" };

export default async function ProductionOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT mo.id, mo.doc_no, si.name as output_name, mo.output_qty::numeric,
           su.code as uom_code, sb.name as output_bin, mo.status,
           mo.total_cost::numeric,
           (mo.total_cost / NULLIF(mo.output_qty, 0))::numeric as unit_cost,
           to_char(mo.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           u.nama as creator_name
    FROM production_orders mo
    JOIN stock_boms b ON mo.bom_id = b.id
    JOIN stock_items si ON b.output_item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    JOIN stock_bins sb ON mo.output_bin_id = sb.id
    JOIN users u ON mo.created_by = u.id
    ORDER BY mo.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Perintah Produksi (Ungkep) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Konversi bahan baku dari gudang menjadi barang setengah jadi ke freezer dengan perhitungan gulung HPP</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <ProductionOrdersTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

