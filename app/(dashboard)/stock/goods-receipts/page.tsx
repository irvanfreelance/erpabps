import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Penerimaan Barang (GRN)" };

export default async function GoodsReceiptsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT gr.id, gr.doc_no, po.doc_no as po_no, sb.name as bin_name,
           gr.status, gr.hpp_method, gr.freight_cost::numeric,
           to_char(gr.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           COALESCE(SUM(grl.goods_value), 0)::numeric as goods_total,
           COALESCE(SUM(grl.all_in_value), 0)::numeric as all_in_total
    FROM goods_receipts gr
    JOIN purchase_orders po ON gr.order_id = po.id
    JOIN stock_bins sb ON gr.bin_id = sb.id
    LEFT JOIN goods_receipt_lines grl ON gr.id = grl.receipt_id
    GROUP BY gr.id, gr.doc_no, po.doc_no, sb.name, gr.status, gr.hpp_method, gr.freight_cost, gr.posted_at
    ORDER BY gr.id DESC
  `;

  return (
    <StockTablePage
      title="Penerimaan Barang (Goods Receipt)"
      subtitle="Barang tiba di gudang pusat dengan perhitungan HPP all-in termasuk alokasi ongkir"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. GRN" },
        { key: "po_no", label: "No. PO" },
        { key: "bin_name", label: "Gudang Masuk" },
        { key: "goods_total", label: "Nilai Barang", render: (r) => fmtRp(r.goods_total), numeric: true },
        { key: "freight_cost", label: "Ongkir Dialokasi", render: (r) => fmtRp(r.freight_cost), numeric: true },
        { key: "all_in_total", label: "Total All-In HPP", render: (r) => <span className="font-bold text-emerald-700">{fmtRp(r.all_in_total)}</span>, numeric: true },
        { key: "hpp_method", label: "Metode HPP", render: (r) => <span className="uppercase text-xs">{r.hpp_method}</span> },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "posted_at", label: "Waktu Penerimaan" },
      ]}
    />
  );
}

