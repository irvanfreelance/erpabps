import { FolderUp } from "lucide-react";
import { EntityPage } from "@/components/shared/entity-page";
import { ImportWizard } from "@/components/forms/import-wizard";
import { GET as listDataImports } from "@/app/api/data-imports/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Imports — CRM RN", description: "Import data" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<Record<string, unknown>> }>(await listDataImports());
  return (
    <div>
      <ImportWizard />
      <EntityPage
        title="Data Imports"
        rows={rows as never[]}
        columns={[
          { key: "entity_type", label: "Tipe" },
          { key: "file_name", label: "File" },
          { key: "row_count_total", label: "Total", numeric: true },
          { key: "row_count_new", label: "Baru", numeric: true },
          { key: "row_count_merge", label: "Merge", numeric: true },
          { key: "status", label: "Status" },
          { key: "uploaded_by", label: "Oleh" },
        ]}
      />
    </div>
  );
}
