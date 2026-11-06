import { Send } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { GET as listBlastBatches } from "@/app/api/blast-batches/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Blast Batches — CRM RN", description: "Laporan blast" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(await listBlastBatches());
  return (
    <EntityPage
      title="Blast Batches"
      rows={rows as never[]}
      columns={[
        { key: "id", label: "ID" },
        { key: "campaign_nama", label: "Campaign" },
        { key: "nama_vendor", label: "Vendor" },
        { key: "tgl_blast", label: "Tgl" },
        { key: "jumlah_target", label: "Target", numeric: true },
        { key: "jumlah_terkirim", label: "Terkirim", numeric: true },
        { key: "jumlah_closing", label: "Closing", numeric: true },
        { key: "import_status", label: "Status" },
      ]}
    />
  );
}
