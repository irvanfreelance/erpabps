import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate, fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Pengiriman (Surat Jalan) — ABPS Stock" };

export default async function ShipmentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sh.id, sh.doc_no, so.doc_no as so_no, sb.name as source_bin,
           to_char(sh.shipped_on, 'YYYY-MM-DD') as shipped_on,
           sh.status,
           COALESCE(SUM(shl.cogs_value), 0)::numeric as total_cogs,
           to_char(sh.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at
    FROM shipments sh
    JOIN sales_orders so ON sh.order_id = so.id
    JOIN stock_bins sb ON sh.bin_id = sb.id
    LEFT JOIN shipment_lines shl ON sh.id = shl.shipment_id
    GROUP BY sh.id, sh.doc_no, so.doc_no, sb.name, sh.shipped_on, sh.status, sh.posted_at
    ORDER BY sh.id DESC
  `;

  return (
    <StockTablePage
      title="Pengiriman Barang (Delivery Orders)"
      subtitle="Surat jalan dan pelepasan stok barang dari freezer ke outlet dan catering"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. Surat Jalan" },
        { key: "so_no", label: "No. Order (SO)" },
        { key: "source_bin", label: "Keluar Dari Bin" },
        { key: "shipped_on", label: "Tanggal Kirim", render: (r) => fmtDate(r.shipped_on) },
        { key: "total_cogs", label: "HPP Stok Keluar", render: (r) => <span className="font-bold text-blue-700">{fmtRp(r.total_cogs)}</span>, numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "posted_at", label: "Waktu Posting" },
      ]}
    />
  );
}

