import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Faktur & Piutang — ABPS Stock" };

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
    <StockTablePage
      title="Faktur Penjualan & Piutang"
      subtitle="Tagihan pusat ke outlet dan catering dengan harga bermargin di atas HPP kirim"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. Faktur" },
        { key: "shipment_no", label: "No. Kirim" },
        { key: "party_name", label: "Pembeli" },
        { key: "party_kind", label: "Kanal", render: (r) => <span className="uppercase text-xs font-semibold">{r.party_kind}</span> },
        { key: "omzet", label: "Nilai Tagihan (Omzet)", render: (r) => fmtRp(r.omzet), numeric: true },
        { key: "cogs", label: "HPP Terkait", render: (r) => fmtRp(r.cogs), numeric: true },
        { key: "laba", label: "Laba Kotor", render: (r) => <span className="font-bold text-emerald-700">{fmtRp(r.laba)}</span>, numeric: true },
        { key: "margin_pct", label: "Margin", render: (r) => <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">+{Number(r.margin_pct).toFixed(0)}%</span>, numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
      ]}
    />
  );
}

