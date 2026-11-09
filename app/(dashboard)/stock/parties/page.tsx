import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PartiesManager } from "@/components/stock/managers/parties-manager";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Rekanan & Mitra" };

export default async function StockPartiesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT id, code, name, party_kind
    FROM stock_parties
    WHERE deleted_at IS NULL
    ORDER BY code ASC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Rekanan, Pemasok & Mitra ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Daftar vendor belanja bahan, outlet cabang, mitra ke-3, dan kanal catering</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PartiesManager rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}
