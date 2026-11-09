import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { BomsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Resep & Komposisi (BOM)" };

export default async function BomsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT b.id, si.name as output_name, b.output_qty::numeric, su.code as uom_code,
           to_char(b.effective_from, 'YYYY-MM-DD') as effective_from,
           to_char(b.effective_to, 'YYYY-MM-DD') as effective_to,
           COUNT(bl.id)::int as material_count
    FROM stock_boms b
    JOIN stock_items si ON b.output_item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    LEFT JOIN stock_bom_lines bl ON b.id = bl.bom_id
    GROUP BY b.id, si.name, b.output_qty, su.code, b.effective_from, b.effective_to
    ORDER BY b.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Resep & Komposisi (BOM) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Standar bahan baku untuk setiap takaran produksi olahan dapur pusat</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <BomsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

