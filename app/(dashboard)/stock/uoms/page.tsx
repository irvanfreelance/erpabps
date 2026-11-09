import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { UomsManager } from "@/components/stock/managers/uoms-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Satuan UOM" };

export default async function StockUomsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT u.id, u.code, u.name,
           COUNT(si.id)::int as item_count
    FROM stock_uoms u
    LEFT JOIN stock_items si ON u.id = si.uom_id AND si.deleted_at IS NULL
    WHERE u.deleted_at IS NULL
    GROUP BY u.id, u.code, u.name
    ORDER BY u.code ASC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Satuan Ukuran / UOM ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Satuan hitung persediaan dapur (kg, gr, pcs, pack, liter)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <UomsManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
