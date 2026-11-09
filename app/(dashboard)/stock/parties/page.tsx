import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Vendor, Outlet & Katering — ABPS Stock" };

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
    <StockTablePage
      title="Master Pihak (Vendor, Outlet & Mitra)"
      subtitle="Mitra bisnis: Vendor pembelian, Outlet Internal, Outlet Pihak Ketiga (sebagai customer), dan Katering"
      rows={jsonSafe(rows)}
      columns={[
        { key: "code", label: "Kode Mitra" },
        { key: "name", label: "Nama Entitas / Rekanan" },
        { key: "party_kind", label: "Jenis Mitra", render: (r) => (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-800">
            {r.party_kind.replace(/_/g, " ")}
          </span>
        )},
        { key: "location_name", label: "Lokasi Internal", render: (r) => r.location_name || "-" },
      ]}
    />
  );
}

