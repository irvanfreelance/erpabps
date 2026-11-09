import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Koreksi / Pembalik Stok — ABPS Stock" };

export default async function StockReversalsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sr.id, sr.doc_no, sr.source_type, sr.source_id, sr.reason,
           u.nama as creator_name,
           to_char(sr.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at
    FROM stock_reversals sr
    JOIN users u ON sr.created_by = u.id
    ORDER BY sr.id DESC
  `;

  return (
    <StockTablePage
      title="Koreksi & Dokumen Pembalik (Reversal)"
      subtitle="Dokumen posted tidak diubah langsung melainkan diperbaiki lewat pembalik yang diaudit"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. Pembalik" },
        { key: "source_type", label: "Dokumen Asal", render: (r) => `${r.source_type} #${r.source_id}` },
        { key: "reason", label: "Alasan Koreksi" },
        { key: "creator_name", label: "Diajukan Oleh" },
        { key: "posted_at", label: "Waktu Eksekusi" },
      ]}
    />
  );
}

