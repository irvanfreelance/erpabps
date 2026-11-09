import { GET as list } from "@/app/api/ranks/route";
import { RanksManager } from "@/components/hrd/ranks-manager";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Pangkat" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: { id: string; code: string; name: string; sort_order: number }[] }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Master pangkat</h1>
      <RanksManager rows={rows} />
    </div>
  );
}
