import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Kartu Stok" };

export default async function StockMovesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sm.id, si.name as item_name, bin.name as bin_name,
           sm.move_kind, sm.qty::numeric, su.code as uom_code,
           sm.value::numeric, sm.unit_cost::numeric,
           sm.source_type, sm.source_id,
           to_char(sm.created_at, 'YYYY-MM-DD HH24:MI') as move_time
    FROM stock_moves sm
    JOIN stock_items si ON sm.item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    JOIN stock_bins bin ON sm.bin_id = bin.id
    ORDER BY sm.id ASC
  `;

  return (
    <StockTablePage
      title="Kartu Stok & Mutasi (Stock Moves)"
      subtitle="Jejak audit setiap pergerakan barang: penerimaan, konsumsi, hasil olahan, dan pengiriman"
      rows={jsonSafe(rows)}
      columns={[
        { key: "move_time", label: "Waktu" },
        { key: "item_name", label: "Nama Barang" },
        { key: "bin_name", label: "Bin Lokasi" },
        { key: "move_kind", label: "Jenis Mutasi", render: (r) => (
          <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
            r.move_kind === 'receipt' || r.move_kind === 'produce' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {r.move_kind}
          </span>
        )},
        { key: "qty", label: "Kuantitas", render: (r) => `${Number(r.qty)} ${r.uom_code}`, numeric: true },
        { key: "unit_cost", label: "Biaya Satuan", render: (r) => fmtRp(r.unit_cost), numeric: true },
        { key: "value", label: "Total Nilai", render: (r) => fmtRp(r.value), numeric: true },
        { key: "source_type", label: "Dokumen Asal", render: (r) => `${r.source_type} #${r.source_id}` },
      ]}
    />
  );
}

