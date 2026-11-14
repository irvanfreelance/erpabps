import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { SalesInvoicesManager } from "@/components/stock/managers/sales-invoices-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Faktur & Piutang Penjualan" };

export default async function SalesInvoicesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT si.id, si.doc_no, p.name as party_name,
           si.amount::numeric, si.cogs_amount::numeric,
           (si.amount - si.cogs_amount)::numeric as laba,
           ROUND(((si.amount - si.cogs_amount) / NULLIF(si.cogs_amount, 0) * 100), 2)::numeric as margin_achieved_pct,
           si.status,
           (SELECT json_agg(json_build_object(
             'id', l.id,
             'item_name', item.name,
             'sku', item.sku,
             'qty', l.qty::numeric,
             'unit_cost', l.unit_cost::numeric,
             'unit_price', l.unit_price::numeric,
             'line_amount', l.line_amount::numeric,
             'cogs_value', l.cogs_value::numeric
           )) FROM sales_invoice_lines l JOIN stock_items item ON l.item_id = item.id WHERE l.invoice_id = si.id) as lines
    FROM sales_invoices si
    JOIN stock_parties p ON si.party_id = p.id
    ORDER BY si.id DESC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Faktur Penjualan & Margin Kanal ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Tagihan penjualan ke outlet cabang dan catering beserta realisasi margin keuntungan di atas HPP</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <SalesInvoicesManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
