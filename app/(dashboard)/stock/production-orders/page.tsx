import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Perintah Produksi" };

export default async function ProductionOrdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT mo.id, mo.doc_no, si.name as output_name, mo.output_qty::numeric,
           su.code as uom_code, sb.name as output_bin, mo.status,
           mo.total_cost::numeric,
           (mo.total_cost / NULLIF(mo.output_qty, 0))::numeric as unit_cost,
           to_char(mo.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           u.nama as creator_name
    FROM production_orders mo
    JOIN stock_boms b ON mo.bom_id = b.id
    JOIN stock_items si ON b.output_item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    JOIN stock_bins sb ON mo.output_bin_id = sb.id
    JOIN users u ON mo.created_by = u.id
    ORDER BY mo.id DESC
  `;

  return (
    <StockTablePage
      title="Perintah Produksi (Ungkep & Olahan)"
      subtitle="Konversi bahan baku dari gudang menjadi barang setengah jadi ke freezer dengan perhitungan gulung HPP"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. MO" },
        { key: "output_name", label: "Barang Hasil" },
        { key: "output_qty", label: "Kuantitas Hasil", render: (r) => `${Number(r.output_qty)} ${r.uom_code}`, numeric: true },
        { key: "output_bin", label: "Lokasi Simpan" },
        { key: "total_cost", label: "Total Biaya Bahan", render: (r) => fmtRp(r.total_cost), numeric: true },
        { key: "unit_cost", label: "HPP Satuan Hasil", render: (r) => <span className="font-bold text-purple-700">{fmtRp(r.unit_cost)} / {r.uom_code}</span>, numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "posted_at", label: "Waktu Selesai" },
      ]}
    />
  );
}

