import { Target } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { GET as listSegments } from "@/app/api/segments/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Segments — CRM RN", description: "Segmen tersimpan" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(await listSegments());
  return (
    <EntityPage
      title="Segments"
      rows={rows as never[]}
      columns={[
        { key: "nama", label: "Nama" },
        { key: "last_count", label: "Count", numeric: true },
        { key: "refresh_schedule", label: "Refresh" },
        { key: "dibuat_oleh_nama", label: "Oleh" },
      ]}
    />
  );
}
