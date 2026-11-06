import { Plug } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { GET as listVendorProfiles } from "@/app/api/vendor-profiles/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Vendors — CRM RN", description: "Profil vendor blast" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(await listVendorProfiles());
  return (
    <EntityPage
      title="Vendor Profiles"
      rows={rows as never[]}
      columns={[
        { key: "id", label: "ID" },
        { key: "nama_vendor", label: "Nama" },
        { key: "is_default", label: "Default" },
      ]}
    />
  );
}
