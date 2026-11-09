import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { VendorBillsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Hutang Vendor" };

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
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Hutang Vendor (Vendor Bills) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Kewajiban bayar vendor yang terbentuk otomatis setelah penerimaan barang (posted)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <VendorBillsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

