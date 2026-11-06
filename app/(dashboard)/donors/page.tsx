import { Users } from "lucide-react";
import { DonorCreateButton } from "@/components/forms/donor-form";
import { DonorsTable, QueryBuilderPanel } from "@/components/donor/donors-client";
import { GET as listDonors } from "@/app/api/donors/route";
import { GET as listFieldDefinitions } from "@/app/api/field-definitions/route";
import { GET as listTags } from "@/app/api/tags/route";
import { fromRoute, internalRequest } from "@/lib/api/from-route";
import type { FieldDef, TagCatalogItem } from "@/lib/org/field-value";
import type { DonorListRow } from "@/types/donor";

export const metadata = { title: "Donors — CRM RN", description: "Daftar donatur" };

export default async function DonorsPage() {
  const [{ rows, total }, fieldsRes, tagsRes] = await Promise.all([
    listDonors(internalRequest("/api/donors?limit=100")).then((res) =>
      fromRoute<{ rows: DonorListRow[]; total: number }>(res),
    ),
    listFieldDefinitions().then((res) => fromRoute<{ rows: FieldDef[] }>(res)),
    listTags().then((res) => fromRoute<{ rows: TagCatalogItem[] }>(res)),
  ]);
  const fields = fieldsRes.rows;
  const tags = tagsRes.rows;
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} color="var(--primary)" />
          <h1 className="m-0 text-[20px] font-bold text-[var(--primary)]">Donatur ({total})</h1>
        </div>
        <DonorCreateButton />
      </div>
      <QueryBuilderPanel fields={fields} tags={tags} />
      <DonorsTable rows={rows as never[]} fields={fields} tags={tags} />
    </div>
  );
}
