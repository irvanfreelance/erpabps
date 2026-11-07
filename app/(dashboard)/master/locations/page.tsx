import Link from "next/link";
import { GET as list } from "@/app/api/locations/route";
import { LocationsWorkspace, type LocationRow } from "@/components/hrd/locations-workspace";
import { fromRoute } from "@/lib/api/from-route";
import { btnPrimary } from "@/components/ui/button";

export const metadata = { title: "Lokasi — ABPS" };

export default async function Page() {
  const { rows } = await fromRoute<{ rows: LocationRow[] }>(await list());
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="mt-0 text-[20px] font-bold text-[var(--primary)]">Lokasi</h1>
        <Link href="/master/locations/new" className={`${btnPrimary} w-full sm:w-auto`}>
          Tambah lokasi
        </Link>
      </div>
      <LocationsWorkspace rows={rows} />
    </div>
  );
}
