import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate } from "@/lib/utils/format";

export const metadata = { title: "Resep & Komposisi (BOM) — ABPS Stock" };

export default async function BomsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT b.id, si.name as output_name, b.output_qty::numeric, su.code as uom_code,
           to_char(b.effective_from, 'YYYY-MM-DD') as effective_from,
           to_char(b.effective_to, 'YYYY-MM-DD') as effective_to,
           COUNT(bl.id)::int as material_count
    FROM stock_boms b
    JOIN stock_items si ON b.output_item_id = si.id
    JOIN stock_uoms su ON si.uom_id = su.id
    LEFT JOIN stock_bom_lines bl ON b.id = bl.bom_id
    GROUP BY b.id, si.name, b.output_qty, su.code, b.effective_from, b.effective_to
    ORDER BY b.id DESC
  `;

  return (
    <StockTablePage
      title="Resep & Komposisi Produksi (BOM)"
      subtitle="Standar bahan baku untuk setiap takaran produksi olahan dapur pusat"
      rows={jsonSafe(rows)}
      columns={[
        { key: "output_name", label: "Barang Hasil" },
        { key: "output_qty", label: "Standar Hasil", render: (r) => `${Number(r.output_qty)} ${r.uom_code}`, numeric: true },
        { key: "material_count", label: "Jumlah Komponen Bahan", numeric: true },
        { key: "effective_from", label: "Berlaku Mulai", render: (r) => fmtDate(r.effective_from) },
        { key: "effective_to", label: "Berlaku Sampai", render: (r) => r.effective_to ? fmtDate(r.effective_to) : "Seterusnya" },
      ]}
    />
  );
}

