import { Megaphone } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { GET as listCampaigns } from "@/app/api/campaigns/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Campaigns — CRM RN", description: "Campaign blast" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(await listCampaigns());
  return (
    <EntityPage
      title="Campaigns"
      rows={rows as never[]}
      columns={[
        { key: "id", label: "ID" },
        { key: "slug", label: "Slug" },
        { key: "nama", label: "Nama" },
        { key: "program_nama", label: "Program" },
        { key: "tipe", label: "Tipe" },
      ]}
    />
  );
}
