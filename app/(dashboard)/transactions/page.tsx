import { Wallet } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { GET as listTransactions } from "@/app/api/transactions/route";
import { fromRoute, internalRequest } from "@/lib/api/from-route";
import { fmtRp, toNum } from "@/lib/utils/format";

export const metadata = { title: "Transactions — CRM RN", description: "Riwayat donasi" };

export default async function Page() {
  const { rows: raw } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(
    await listTransactions(internalRequest("/api/transactions?limit=200")),
  );
  const rows = raw.map((r) => ({
    ...r,
    nominal: fmtRp(toNum(r.nominal)),
  }));
  return (
    <EntityPage
      title="Transactions"
      rows={rows as never[]}
      columns={[
        { key: "id", label: "ID" },
        { key: "nama_lengkap", label: "Donatur" },
        { key: "program_nama", label: "Program" },
        { key: "campaign_nama", label: "Campaign" },
        { key: "tgl_transaksi", label: "Tgl" },
        { key: "nominal", label: "Nominal", numeric: true },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
