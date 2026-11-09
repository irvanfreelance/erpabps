import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtRp } from "@/lib/utils/format";

export const metadata = { title: "Saldo Persediaan — ABPS Stock" };

export default async function StockBalancesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sb.id, si.sku, si.name as item_name, si.item_kind,
           bin.code as bin_code, bin.name as bin_name,
           sb.qty::numeric, su.code as uom_code,
           sb.unit_cost::numeric, sb.value::numeric
    FROM stock_balances sb
    JOIN stock_items si ON sb.item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    JOIN stock_bins bin ON sb.bin_id = bin.id
    ORDER BY bin.code, si.sku
  `;

  return (
    <StockTablePage
      title="Saldo Stok & Nilai Persediaan"
      subtitle="Kuantitas fisik dan nilai total HPP persediaan berjalan di gudang dan freezer"
      rows={jsonSafe(rows)}
      columns={[
        { key: "sku", label: "SKU" },
        { key: "item_name", label: "Nama Barang" },
        { key: "bin_name", label: "Lokasi Simpan (Bin)" },
        { key: "qty", label: "Kuantitas Saldo", render: (r) => `${Number(r.qty)} ${r.uom_code}`, numeric: true },
        { key: "unit_cost", label: "HPP Satuan", render: (r) => fmtRp(r.unit_cost), numeric: true },
        { key: "value", label: "Total Nilai Persediaan", render: (r) => <span className="font-bold text-emerald-800">{fmtRp(r.value)}</span>, numeric: true },
      ]}
    />
  );
}

