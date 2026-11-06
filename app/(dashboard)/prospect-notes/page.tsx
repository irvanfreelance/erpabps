import { FileText } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { GET as listProspectNotes } from "@/app/api/prospect-notes/route";
import { fromRoute, internalRequest } from "@/lib/api/from-route";

export const metadata = { title: "Prospect Notes — CRM RN", description: "Catatan prospek" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(
    await listProspectNotes(internalRequest("/api/prospect-notes")),
  );
  return (
    <EntityPage
      title="Prospect Notes"
      rows={rows as never[]}
      columns={[
        { key: "nama_lengkap", label: "Donatur" },
        { key: "user_nama", label: "PIC" },
        { key: "tgl_prospek", label: "Tgl" },
        { key: "channel", label: "Channel" },
        { key: "respon_donatur", label: "Respon" },
        { key: "catatan_bebas", label: "Catatan" },
      ]}
    />
  );
}
