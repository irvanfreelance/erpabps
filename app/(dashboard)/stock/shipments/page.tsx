import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ShipmentsTable } from "@/components/stock/stock-tables";
import { PostForm } from "@/components/stock/post-form";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Pengiriman (Surat Jalan)" };

export default async function ShipmentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, orders, bins, items] = await Promise.all([
    sql`
    SELECT sh.id, sh.doc_no, so.doc_no as so_no, sb.name as source_bin,
           to_char(sh.shipped_on, 'YYYY-MM-DD') as shipped_on,
           sh.status,
           COALESCE(SUM(shl.cogs_value), 0)::numeric as total_cogs,
           to_char(sh.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           (SELECT json_agg(json_build_object(
             'id', sl.id,
             'item_name', si.name,
             'sku', si.sku,
             'qty', sl.qty::numeric,
             'unit_cost', sl.unit_cost::numeric,
             'cogs_value', sl.cogs_value::numeric
           ) ORDER BY sl.id)
            FROM shipment_lines sl
            JOIN stock_items si ON si.id = sl.item_id
            WHERE sl.shipment_id = sh.id) AS lines
    FROM shipments sh
    JOIN sales_orders so ON sh.order_id = so.id
    JOIN stock_bins sb ON sh.bin_id = sb.id
    LEFT JOIN shipment_lines shl ON sh.id = shl.shipment_id
    GROUP BY sh.id, sh.doc_no, so.doc_no, sb.name, sh.shipped_on, sh.status, sh.posted_at
    ORDER BY sh.id DESC
  `,
    sql`
      SELECT so.id::text AS id, so.doc_no || ' — ' || sp.name AS label
      FROM sales_orders so
      JOIN stock_parties sp ON sp.id = so.party_id
      WHERE so.status IN ('draft', 'posted')
      ORDER BY so.id DESC
    `,
    sql`SELECT id::text AS id, name AS label FROM stock_bins WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT id::text AS id, sku || ' — ' || name AS label FROM stock_items WHERE deleted_at IS NULL AND item_kind IN ('semi_finished', 'finished', 'finished_good') ORDER BY name`,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Pengiriman Barang (Surat Jalan) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Surat jalan dan pelepasan stok barang dari freezer ke outlet dan catering</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PostForm
          title="Buat & Posting Pengiriman"
          docPrefix="DO"
          endpoint="/api/stock/shipments"
          hint="Stok keluar pada biaya saldo (rata-rata bergerak atau FIFO sesuai pengaturan). Order draft ikut menjadi posted."
          items={jsonSafe(items) as { id: string; label: string }[]}
          lineMode="qty"
          fields={[
            { name: "doc_no", label: "Nomor surat jalan", kind: "text" },
            { name: "order_id", label: "Order penjualan", kind: "select", options: jsonSafe(orders) as { id: string; label: string }[] },
            { name: "bin_id", label: "Bin asal", kind: "select", options: jsonSafe(bins) as { id: string; label: string }[] },
            { name: "shipped_on", label: "Tanggal kirim", kind: "date" },
          ]}
        />
        <ShipmentsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

