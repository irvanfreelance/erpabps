import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { SalesInvoicesTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Faktur & Piutang" };

export default async function SalesInvoicesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT si.id, si.doc_no, sh.doc_no as shipment_no, sp.name as party_name,
           sp.party_kind, si.amount::numeric as omzet,
           si.cogs_amount::numeric as cogs,
           (si.amount - si.cogs_amount)::numeric as laba,
           ROUND(((si.amount - si.cogs_amount) / NULLIF(si.cogs_amount, 0) * 100), 2)::numeric as margin_pct,
           si.status, u.nama as creator_name
    FROM sales_invoices si
    JOIN shipments sh ON si.shipment_id = sh.id
    JOIN stock_parties sp ON si.party_id = sp.id
    JOIN users u ON si.created_by = u.id
    ORDER BY si.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Faktur Penjualan & Piutang ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Tagihan pusat ke outlet dan catering dengan harga bermargin di atas HPP kirim</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <SalesInvoicesTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

