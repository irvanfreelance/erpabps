import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { CashFundsManager } from "@/components/stock/managers/cash-funds-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Kas Operasional" };

  export default async function StockCashFundsPage() {
    const session = await getServerSession();
    if (!session) redirect("/login");
    const isSuperadmin = session.user.role === "superadmin";
    if (!isSuperadmin) redirect("/employees");

    const sql = getDb();
    const rows = await sql`
    SELECT id, code, name, balance::numeric
    FROM cash_funds
    ORDER BY id ASC
  `;

    return (
      <div className="space-y-4">
        <div>
          <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
            Kas Dapur & Operasional ({jsonSafe(rows).length})
          </h1>
          <p className="text-xs text-gray-500 m-0">Dana operasional dapur untuk pelunasan belanja bahan baku harian</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
          <CashFundsManager rows={jsonSafe(rows) as never} />
        </div>
      </div>
    );
  }
