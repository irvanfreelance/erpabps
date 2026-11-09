import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate, fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Pembayaran Vendor" };

export default async function VendorPaymentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT vp.id, vp.doc_no, vb.doc_no as bill_no, sp.name as vendor_name,
           vp.amount::numeric, to_char(vp.paid_on, 'YYYY-MM-DD') as paid_on,
           cf.name as fund_name, vp.status, u.nama as creator_name
    FROM vendor_payments vp
    JOIN vendor_bills vb ON vp.bill_id = vb.id
    JOIN stock_parties sp ON vb.vendor_id = sp.id
    LEFT JOIN cash_funds cf ON vp.fund_id = cf.id
    JOIN users u ON vp.created_by = u.id
    ORDER BY vp.id DESC
  `;

  return (
    <StockTablePage
      title="Pembayaran Vendor (Vendor Payments)"
      subtitle="Realisasi pelunasan hutang vendor hanya setelah barang tiba dan tercatat posted"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. Bayar" },
        { key: "bill_no", label: "No. Tagihan" },
        { key: "vendor_name", label: "Vendor" },
        { key: "amount", label: "Jumlah Dibayar", render: (r) => <span className="font-bold text-emerald-700">{fmtRp(r.amount)}</span>, numeric: true },
        { key: "paid_on", label: "Tanggal Bayar", render: (r) => fmtDate(r.paid_on) },
        { key: "fund_name", label: "Sumber Kas", render: (r) => r.fund_name || "Kas Umum" },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Diproses Oleh" },
      ]}
    />
  );
}

