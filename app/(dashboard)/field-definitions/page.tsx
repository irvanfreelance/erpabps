import { FieldDefinitionsManager } from "@/components/forms/field-definition-form";
import { GET as listFieldDefinitions } from "@/app/api/field-definitions/route";
import { fromRoute } from "@/lib/api/from-route";
import type { FieldDef } from "@/lib/org/field-value";

export const metadata = { title: "Fields — CRM RN", description: "Dynamic fields" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: FieldDef[] }>(await listFieldDefinitions());
  return <FieldDefinitionsManager rows={rows} />;
}
