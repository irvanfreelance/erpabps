import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { VendorPaymentsManager } from "@/components/stock/managers/vendor-payments-manager";
import { PostForm } from "@/components/stock/post-form";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Pembayaran Vendor" };

export default async function VendorPaymentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, bills, funds] = await Promise.all([
    sql`
    SELECT vp.id, vp.doc_no, vb.doc_no as bill_no,
           sp.name as vendor_name, cf.name as fund_name,
           vp.amount::numeric,
           to_char(vp.paid_on, 'YYYY-MM-DD') as paid_on,
           vp.status
    FROM vendor_payments vp
    JOIN vendor_bills vb ON vp.bill_id = vb.id
    JOIN stock_parties sp ON vb.vendor_id = sp.id
    JOIN cash_funds cf ON vp.fund_id = cf.id
    ORDER BY vp.id DESC
  `,
    sql`
      SELECT vb.id::text AS id,
             vb.doc_no || ' — sisa ' || vb.amount_open::text AS label
      FROM vendor_bills vb
      JOIN goods_receipts gr ON gr.id = vb.receipt_id
      WHERE vb.status = 'open' AND vb.amount_open > 0 AND gr.status = 'posted'
      ORDER BY vb.id DESC
    `,
    sql`SELECT id::text AS id, name || ' — ' || balance::text AS label FROM cash_funds ORDER BY name`,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Pembayaran Tagihan Vendor ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Riwayat pengeluaran kas operasional dapur untuk melunasi hutang belanja</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PostForm
          title="Buat & Posting Pembayaran"
          docPrefix="PAY"
          endpoint="/api/stock/vendor-payments"
          hint="Uang keluar hanya untuk tagihan yang barangnya sudah diterima. Saldo kas berkurang lewat entri kas."
          fields={[
            { name: "doc_no", label: "Nomor bayar", kind: "text" },
            { name: "bill_id", label: "Tagihan", kind: "select", options: jsonSafe(bills) as { id: string; label: string }[] },
            { name: "fund_id", label: "Kas", kind: "select", options: jsonSafe(funds) as { id: string; label: string }[] },
            { name: "amount", label: "Nilai", kind: "number" },
            { name: "paid_on", label: "Tanggal bayar", kind: "date" },
          ]}
        />
        <VendorPaymentsManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
