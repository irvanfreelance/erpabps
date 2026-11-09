import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PriceListsTable } from "@/components/stock/stock-tables";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Daftar Harga & Margin" };

export default async function PriceListsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const isSuperadmin = session.user.role === "superadmin" || Boolean(session.user.impersonatedBy);
  if (!isSuperadmin) redirect("/employees");

  const sql = getDb();
  const rows = await sql`
    SELECT id, code, party_kind, margin_percent::numeric,
           to_char(effective_from, 'YYYY-MM-DD') as effective_from,
           to_char(effective_to, 'YYYY-MM-DD') as effective_to
    FROM stock_price_lists
    ORDER BY id ASC
  `;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          Daftar Harga & Kebijakan Margin ({jsonSafe(rows).length})
        </h1>
        <p className="text-xs text-gray-500 m-0">Persentase margin harga jual di atas HPP satuan per kanal penerima</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <PriceListsTable rows={jsonSafe(rows) as never} />
      </div>
    </div>
  );
}

