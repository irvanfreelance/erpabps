import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { VendorBillsManager } from "@/components/stock/managers/vendor-bills-manager";
import { PostForm } from "@/components/stock/post-form";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Tagihan & Hutang Vendor" };

export default async function VendorBillsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, receipts] = await Promise.all([
    sql`
    SELECT vb.id, vb.doc_no, gr.doc_no as receipt_no,
           sp.name as vendor_name, vb.amount::numeric,
           vb.amount_open::numeric,
           to_char(vb.due_date, 'YYYY-MM-DD') as due_date,
           vb.status
    FROM vendor_bills vb
    JOIN goods_receipts gr ON vb.receipt_id = gr.id
    JOIN stock_parties sp ON vb.vendor_id = sp.id
    ORDER BY vb.id DESC
  `,
    sql`
      SELECT gr.id::text AS id,
             gr.doc_no || ' — ' || COALESCE(SUM(grl.all_in_value), 0)::text AS label
      FROM goods_receipts gr
      JOIN goods_receipt_lines grl ON grl.receipt_id = gr.id
      WHERE gr.status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM vendor_bills vb WHERE vb.receipt_id = gr.id)
        AND NOT EXISTS (SELECT 1 FROM stock_reversals r WHERE r.source_type = 'goods_receipt' AND r.source_id = gr.id)
      GROUP BY gr.id, gr.doc_no
      ORDER BY gr.id DESC
    `,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Tagihan & Hutang Vendor ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Kewajiban pembayaran atas penerimaan belanja bahan baku (GRN)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PostForm
          title="Buat & Posting Tagihan"
          docPrefix="BILL"
          endpoint="/api/stock/vendor-bills"
          hint="Nilai tagihan mengikuti total all-in penerimaan. Bayar hanya setelah tagihan ini terbuka."
          fields={[
            { name: "doc_no", label: "Nomor tagihan", kind: "text" },
            { name: "receipt_id", label: "Penerimaan", kind: "select", options: jsonSafe(receipts) as { id: string; label: string }[] },
            { name: "due_date", label: "Jatuh tempo", kind: "date" },
          ]}
        />
        <VendorBillsManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
