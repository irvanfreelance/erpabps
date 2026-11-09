import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { VendorPaymentsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

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
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Pembayaran Vendor ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Realisasi pelunasan hutang vendor hanya setelah barang tiba dan tercatat posted</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <VendorPaymentsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

