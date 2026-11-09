import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PurchaseRequestsManager } from "@/components/stock/managers/purchase-requests-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Permintaan Belanja" };

export default async function PurchaseRequestsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const [rows, availableItems] = await Promise.all([
    sql`
      SELECT pr.id, pr.doc_no, pr.source_unit, pr.status,
             to_char(pr.needed_on, 'YYYY-MM-DD') as needed_on,
             u.nama as creator_name,
             to_char(pr.posted_at, 'YYYY-MM-DD HH24:MI') as posted_at,
             COUNT(prl.id)::int as line_count,
             (SELECT json_agg(json_build_object(
               'id', l.id,
               'item_name', si.name,
               'sku', si.sku,
               'qty', l.qty::numeric
             )) FROM purchase_request_lines l JOIN stock_items si ON l.item_id = si.id WHERE l.request_id = pr.id) as lines
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN purchase_request_lines prl ON pr.id = prl.request_id
      GROUP BY pr.id, pr.doc_no, pr.source_unit, pr.status, pr.needed_on, u.nama, pr.posted_at
      ORDER BY pr.id DESC
    `,
    sql`SELECT id, name, sku FROM stock_items WHERE deleted_at IS NULL ORDER BY name ASC`,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Permintaan Belanja Bahan (PR) ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Pengajuan kebutuhan bahan baku dari unit operasional dapur sebelum dibuatkan PO</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PurchaseRequestsManager
          rows={jsonSafe(rows) as never}
          availableItems={jsonSafe(availableItems) as never}
        />
      </div>
    </div>
  );
}
