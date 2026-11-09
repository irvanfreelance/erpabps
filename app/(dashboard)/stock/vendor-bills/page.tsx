import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate, fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Hutang Vendor — ABPS Stock" };

export default async function VendorBillsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT vb.id, vb.doc_no, gr.doc_no as grn_no, sp.name as vendor_name,
           vb.amount::numeric, vb.amount_open::numeric,
           to_char(vb.due_date, 'YYYY-MM-DD') as due_date,
           vb.status
    FROM vendor_bills vb
    JOIN goods_receipts gr ON vb.receipt_id = gr.id
    JOIN stock_parties sp ON vb.vendor_id = sp.id
    ORDER BY vb.id DESC
  `;

  return (
    <StockTablePage
      title="Hutang Vendor (Vendor Bills)"
      subtitle="Kewajiban bayar vendor yang terbentuk otomatis setelah penerimaan barang (posted)"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. Tagihan" },
        { key: "grn_no", label: "Ref GRN" },
        { key: "vendor_name", label: "Nama Vendor" },
        { key: "amount", label: "Total Tagihan", render: (r) => fmtRp(r.amount), numeric: true },
        { key: "amount_open", label: "Sisa Hutang", render: (r) => <span className={Number(r.amount_open) > 0 ? "font-bold text-red-600" : "text-emerald-700 font-semibold"}>{fmtRp(r.amount_open)}</span>, numeric: true },
        { key: "due_date", label: "Jatuh Tempo", render: (r) => fmtDate(r.due_date) },
        { key: "status", label: "Status", render: (r) => (
          <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${r.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {r.status === 'paid' ? 'Lunas' : 'Belum Lunas'}
          </span>
        )},
      ]}
    />
  );
}

