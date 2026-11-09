import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { CashFundsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Kas Dapur & Operasional" };

export default async function CashFundsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT cf.id, cf.code, cf.name, cf.balance::numeric,
           COUNT(cfe.id)::int as total_entries,
           COALESCE(SUM(CASE WHEN cfe.entry_kind = 'topup' THEN cfe.amount ELSE 0 END), 0)::numeric as total_topup,
           COALESCE(SUM(CASE WHEN cfe.entry_kind = 'spend' THEN cfe.amount ELSE 0 END), 0)::numeric as total_spend
    FROM cash_funds cf
    LEFT JOIN cash_fund_entries cfe ON cf.id = cfe.fund_id
    GROUP BY cf.id, cf.code, cf.name, cf.balance
    ORDER BY cf.id ASC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Kas Operasional & Dapur ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pencatatan uang muka operasional dapur beserta realisasi belanja dan sisa saldo</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <CashFundsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

