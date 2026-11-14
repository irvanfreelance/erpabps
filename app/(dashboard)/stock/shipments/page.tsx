import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ShipmentsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Pengiriman (Surat Jalan)" };

export default async function ShipmentsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin";
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
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Pengiriman Barang (Surat Jalan) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Surat jalan dan pelepasan stok barang dari freezer ke outlet dan catering</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <ShipmentsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

