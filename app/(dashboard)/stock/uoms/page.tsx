import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Satuan Ukur (UoM)" };

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
    <StockTablePage
      title="Satuan Ukur (Unit of Measure)"
      subtitle="Standar satuan kuantitas inventori (Kilogram, Gram, Pcs, Liter)"
      rows={jsonSafe(rows)}
      columns={[
        { key: "code", label: "Kode Satuan" },
        { key: "name", label: "Nama Satuan" },
        { key: "item_count", label: "Dipakai di Katalog", numeric: true },
      ]}
    />
  );
}

