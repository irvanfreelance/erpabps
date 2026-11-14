import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockMovesTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Kartu Stok" };

export default async function StockMovesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sm.id, si.name as item_name, bin.name as bin_name,
           sm.move_kind, sm.qty::numeric, su.code as uom_code,
           sm.value::numeric, sm.unit_cost::numeric,
           sm.source_type, sm.source_id,
           to_char(sm.created_at, 'YYYY-MM-DD HH24:MI') as move_time
    FROM stock_moves sm
    JOIN stock_items si ON sm.item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    JOIN stock_bins bin ON sm.bin_id = bin.id
    ORDER BY sm.id ASC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Kartu Stok & Mutasi ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Jejak audit setiap pergerakan barang: penerimaan, konsumsi, hasil olahan, dan pengiriman</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockMovesTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

