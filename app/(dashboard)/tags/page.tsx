import { TagManager } from "@/components/forms/tag-manager";
import { GET as listTags } from "@/app/api/tags/route";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Label donatur — CRM RN", description: "Katalog tag donatur" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: Array<{ id: string; slug: string; nama: string; warna: string; deskripsi: string | null; is_active: boolean }> }>(await listTags());
  return <TagManager rows={rows} />;
}
