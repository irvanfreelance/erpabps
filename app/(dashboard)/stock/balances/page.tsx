import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockBalancesTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Saldo Persediaan" };

export default async function StockBalancesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sb.id, si.sku, si.name as item_name, si.item_kind,
           bin.code as bin_code, bin.name as bin_name,
           sb.qty::numeric, su.code as uom_code,
           sb.unit_cost::numeric, sb.value::numeric
    FROM stock_balances sb
    JOIN stock_items si ON sb.item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    JOIN stock_bins bin ON sb.bin_id = bin.id
    ORDER BY bin.code, si.sku
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Saldo Persediaan & Nilai ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Kuantitas fisik dan nilai total HPP persediaan berjalan di gudang dan freezer</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockBalancesTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

