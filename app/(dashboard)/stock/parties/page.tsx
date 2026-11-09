import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockPartiesTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Vendor, Outlet & Katering" };

export default async function StockPartiesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT sp.id, sp.code, sp.name, sp.party_kind,
           l.name as location_name
    FROM stock_parties sp
    LEFT JOIN locations l ON sp.location_id = l.id
    WHERE sp.deleted_at IS NULL
    ORDER BY sp.party_kind, sp.name
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Vendor, Outlet & Mitra ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Mitra bisnis: Vendor pembelian, Outlet Internal, Outlet Pihak Ketiga (sebagai customer), dan Katering</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <StockPartiesTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

