import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Kas Dapur & Operasional — ABPS Stock" };

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
    <StockTablePage
      title="Kas Operasional & Dapur"
      subtitle="Pencatatan uang muka operasional dapur beserta realisasi belanja dan sisa saldo"
      rows={jsonSafe(rows)}
      columns={[
        { key: "code", label: "Kode Kas" },
        { key: "name", label: "Nama Buku Kas" },
        { key: "total_topup", label: "Total Uang Masuk", render: (r) => fmtRp(r.total_topup), numeric: true },
        { key: "total_spend", label: "Total Realisasi Belanja", render: (r) => fmtRp(r.total_spend), numeric: true },
        { key: "balance", label: "Sisa Saldo Kas", render: (r) => <span className="font-bold text-emerald-800 text-sm">{fmtRp(r.balance)}</span>, numeric: true },
        { key: "total_entries", label: "Jumlah Transaksi", numeric: true },
      ]}
    />
  );
}

