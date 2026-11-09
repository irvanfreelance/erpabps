import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate } from "@/lib/utils/format";

export const metadata = { title: "Permintaan Belanja" };

export default async function PurchaseRequestsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT pr.id, pr.doc_no, pr.source_unit, pr.status,
           to_char(pr.needed_on, 'YYYY-MM-DD') as needed_on,
           u.nama as creator_name,
           to_char(pr.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
           COUNT(prl.id)::int as line_count
    FROM purchase_requests pr
    JOIN users u ON pr.created_by = u.id
    LEFT JOIN purchase_request_lines prl ON pr.id = prl.request_id
    GROUP BY pr.id, pr.doc_no, pr.source_unit, pr.status, pr.needed_on, u.nama, pr.posted_at
    ORDER BY pr.id DESC
  `;

  return (
    <StockTablePage
      title="Permintaan Belanja (Purchase Request)"
      subtitle="Rencana dan permintaan belanja harian dari unit Dapur atau Outlet"
      rows={jsonSafe(rows)}
      columns={[
        { key: "doc_no", label: "No. Dokumen" },
        { key: "source_unit", label: "Unit Asal", render: (r) => <span className="uppercase font-semibold text-xs">{r.source_unit}</span> },
        { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
        { key: "needed_on", label: "Dibutuhkan Pada", render: (r) => fmtDate(r.needed_on) },
        { key: "line_count", label: "Jml Item", numeric: true },
        { key: "creator_name", label: "Dibuat Oleh" },
        { key: "posted_at", label: "Waktu Posting" },
      ]}
    />
  );
}

