import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PriceListsManager } from "@/components/stock/managers/price-lists-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Daftar Harga & Margin" };

  export default async function StockPriceListsPage() {
    const session = await getServerSession();
    if (!session) redirect("/login");
    const isSuperadmin = session.user.role === "superadmin";
    if (!isSuperadmin) redirect("/employees");

    const sql = getDb();
    const rows = await sql`
    SELECT pl.id, pl.code, pl.party_kind, pl.margin_percent::numeric,
           to_char(pl.effective_from, 'YYYY-MM-DD') as effective_from,
           to_char(pl.effective_to, 'YYYY-MM-DD') as effective_to
    FROM stock_price_lists pl
    ORDER BY pl.id ASC
  `;

    return (
      <div className="space-y-4">
        <div>
          <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
            Daftar Harga & Margin ({jsonSafe(rows).length})
          </h1>
          <p className="text-xs text-gray-500 m-0">Aturan margin otomatis berdasarkan persentase di atas HPP berjalan (Outlet 20%, Catering 30%)</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
          <PriceListsManager rows={jsonSafe(rows) as never} />
        </div>
      </div>
    );
  }
