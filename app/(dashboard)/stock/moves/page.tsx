import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockMovesTable } from "@/components/stock/stock-tables";
import { MovesFilter } from "@/components/stock/moves-filter";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Kartu Stok" };

export default async function StockMovesPage({
  searchParams,
}: {
  searchParams?: Promise<{ start_date?: string; end_date?: string; item_id?: string; bin_id?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/employees");

  const sp = searchParams ? await searchParams : {};
  const start = sp.start_date && /^\d{4}-\d{2}-\d{2}$/.test(sp.start_date) ? sp.start_date : null;
  const end = sp.end_date && /^\d{4}-\d{2}-\d{2}$/.test(sp.end_date) ? sp.end_date : null;
  const itemId = sp.item_id && /^\d+$/.test(sp.item_id) ? sp.item_id : null;
  const binId = sp.bin_id && /^\d+$/.test(sp.bin_id) ? sp.bin_id : null;

  const sql = getDb();
  const [rows, items, bins] = await Promise.all([
    sql`
      WITH signed AS (
        SELECT sm.id, si.name AS item_name, bin.name AS bin_name,
               sm.move_kind, sm.qty::numeric, su.code AS uom_code,
               sm.value::numeric, sm.unit_cost::numeric,
               sm.source_type, sm.source_id, sm.created_at, sm.item_id, sm.bin_id,
               to_char(sm.created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') AS move_time,
               CASE sm.move_kind
                 WHEN 'receipt' THEN sm.qty WHEN 'produce' THEN sm.qty
                 WHEN 'consume' THEN -sm.qty WHEN 'ship' THEN -sm.qty
                 ELSE sm.qty
               END AS signed_qty
        FROM stock_moves sm
        JOIN stock_items si ON sm.item_id = si.id
        JOIN stock_uoms su ON si.uom_id = su.id
        JOIN stock_bins bin ON sm.bin_id = bin.id
      ),
      running AS (
        SELECT *, SUM(signed_qty) OVER (PARTITION BY item_id, bin_id ORDER BY created_at, id) AS running_qty
        FROM signed
      )
      SELECT id, item_name, bin_name, move_kind, qty, uom_code, value, unit_cost,
             source_type, source_id, move_time, running_qty::numeric
      FROM running
      WHERE (${start}::date IS NULL OR created_at >= (${start}::date AT TIME ZONE 'Asia/Jakarta'))
        AND (${end}::date IS NULL OR created_at < ((${end}::date + 1) AT TIME ZONE 'Asia/Jakarta'))
        AND (${itemId}::bigint IS NULL OR item_id = ${itemId}::bigint)
        AND (${binId}::bigint IS NULL OR bin_id = ${binId}::bigint)
      ORDER BY created_at DESC, id DESC
    `,
    sql`SELECT id::text, sku || ' — ' || name AS label FROM stock_items WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT id::text, name AS label FROM stock_bins WHERE deleted_at IS NULL ORDER BY name`,
  ]);

  const safeRows = jsonSafe(rows);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Kartu Stok & Mutasi ({safeRows.length})
        </h1>
        <p className="m-0 text-xs text-gray-500">
          Jejak penerimaan, konsumsi, hasil olahan, pengiriman, opname, dan pembalik. Saldo berjalan menghitung seluruh riwayat barang di bin itu.
        </p>
      </div>
      <MovesFilter
        items={jsonSafe(items) as { id: string; label: string }[]}
        bins={jsonSafe(bins) as { id: string; label: string }[]}
        initial={{ start_date: start ?? "", end_date: end ?? "", item_id: itemId ?? "", bin_id: binId ?? "" }}
      />
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs md:p-5">
        <StockMovesTable rows={safeRows as never} />
      </div>
    </div>
  );
}
