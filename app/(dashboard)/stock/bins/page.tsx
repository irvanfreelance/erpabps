import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockBinsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Bin Gudang & Freezer" };

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
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Master Bin Gudang & Freezer ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Tempat fisik penyimpanan barang di dapur pusat (Gudang Penerimaan & Freezer Olahan)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockBinsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

