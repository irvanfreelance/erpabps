import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate } from "@/lib/utils/format";

export const metadata = { title: "Stock Opname — ABPS Stock" };

export default async function StockCountsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sc.id, sc.doc_no, sb.name as bin_name,
           to_char(sc.counted_on, 'YYYY-MM-DD') as counted_on,
           sc.status, u.nama as creator_name,
           COUNT(scl.id)::int as total_lines
    FROM stock_counts sc
    JOIN stock_bins sb ON sc.bin_id = sb.id
    JOIN users u ON sc.created_by = u.id
    LEFT JOIN stock_count_lines scl ON sc.id = scl.count_id
    GROUP BY sc.id, sc.doc_no, sb.name, sc.counted_on, sc.status, u.nama
    ORDER BY sc.id DESC
  `;

  return (
    <StockTablePage
      title="Stock Opname (Penghitungan Fisik)"
      subtitle="Pencocokan kuantitas sistem dengan fisik berkala di gudang dan freezer"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. Dokumen" },
        { key: "bin_name", label: "Lokasi Bin Dihitung" },
        { key: "counted_on", label: "Tanggal Hitung", render: (r) => fmtDate(r.counted_on) },
        { key: "total_lines", label: "Item Dihitung", numeric: true },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "creator_name", label: "Petugas Opname" },
      ]}
    />
  );
}

