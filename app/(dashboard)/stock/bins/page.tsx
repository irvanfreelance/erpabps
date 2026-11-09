import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { BinsManager } from "@/components/stock/managers/bins-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Bin Lokasi" };

export default async function StockBinsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT b.id, b.code, b.name, b.bin_kind, b.is_receiving,
           COUNT(sb.id)::int as balance_count
    FROM stock_bins b
    LEFT JOIN stock_balances sb ON b.id = sb.bin_id AND sb.qty > 0
    WHERE b.deleted_at IS NULL
    GROUP BY b.id, b.code, b.name, b.bin_kind, b.is_receiving
    ORDER BY b.code ASC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Bin Lokasi Gudang ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Tempat penyimpanan fisik barang (Gudang Bahan, Freezer Penyimpanan)</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <BinsManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
