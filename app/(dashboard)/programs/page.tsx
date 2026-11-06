import { Bookmark } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { GET as listPrograms } from "@/app/api/programs/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Programs — CRM RN", description: "Master program" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(await listPrograms());
  return (
    <EntityPage
      title="Programs"
      rows={rows as never[]}
      columns={[
        { key: "id", label: "ID" },
        { key: "slug", label: "Slug" },
        { key: "nama", label: "Nama" },
        { key: "kategori", label: "Kategori" },
        { key: "is_active", label: "Status" },
      ]}
    />
  );
}
