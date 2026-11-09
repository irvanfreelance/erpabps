import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { StockTablePage } from "@/components/stock/stock-table-page";
import { jsonSafe } from "@/lib/utils/serialize";
import { fmtDate } from "@/lib/utils/format";

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
    <StockTablePage
      title="Daftar Harga & Kebijakan Margin"
      subtitle="Persentase margin harga jual di atas HPP satuan per kanal penerima"
      rows={jsonSafe(rows)}
      columns={[
        { key: "code", label: "Kode Daftar Harga" },
        { key: "party_kind", label: "Kanal Penerima", render: (r) => <span className="uppercase text-xs font-semibold">{r.party_kind}</span> },
        { key: "margin_percent", label: "Margin Keuntungan", render: (r) => <span className="font-bold text-emerald-700 text-sm">+{Number(r.margin_percent).toFixed(1)}%</span>, numeric: true },
        { key: "effective_from", label: "Berlaku Mulai", render: (r) => fmtDate(r.effective_from) },
        { key: "effective_to", label: "Berlaku Sampai", render: (r) => r.effective_to ? fmtDate(r.effective_to) : "Seterusnya" },
      ]}
    />
  );
}

