import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockReversalsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Koreksi / Pembalik Stok" };

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
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Koreksi & Dokumen Pembalik ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Dokumen posted tidak diubah langsung melainkan diperbaiki lewat pembalik yang diaudit</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockReversalsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

