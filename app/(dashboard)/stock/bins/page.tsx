import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Bin Gudang & Freezer — ABPS Stock" };

export default async function StockBinsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sb.id, sb.code, sb.name, sb.bin_kind, sb.is_receiving,
           l.name as location_name
    FROM stock_bins sb
    LEFT JOIN locations l ON sb.location_id = l.id
    WHERE sb.deleted_at IS NULL
    ORDER BY sb.id ASC
  `;

  return (
    <StockTablePage
      title="Master Bin Gudang & Freezer"
      subtitle="Tempat fisik penyimpanan barang di dapur pusat (Gudang Penerimaan & Freezer Olahan)"
      rows={jsonSafe(rows)}
      columns={[
        { key: "code", label: "Kode Bin" },
        { key: "name", label: "Nama Bin / Ruang" },
        { key: "bin_kind", label: "Fungsi Bin", render: (r) => <span className="uppercase text-xs font-semibold">{r.bin_kind}</span> },
        { key: "is_receiving", label: "Pintu Masuk Pembelian", render: (r) => r.is_receiving ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Ya (Penerimaan Utama)</span>
        ) : "Tidak" },
        { key: "location_name", label: "Lokasi Fisik", render: (r) => r.location_name || "Dapur Pusat" },
      ]}
    />
  );
}

