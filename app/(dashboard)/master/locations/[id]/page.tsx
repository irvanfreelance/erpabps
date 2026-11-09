import { notFound } from "next/navigation";
import { GET as getLocation } from "@/app/api/locations/[id]/route";
import { LocationForm } from "@/components/hrd/location-form";
import type { LocationRow } from "@/components/hrd/locations-workspace";
import { fromRoute, internalRequest, RouteError } from "@/lib/api/from-route";

export const metadata = { title: "Ubah lokasi" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let row: LocationRow;
  try {
    row = await fromRoute<LocationRow>(await getLocation(internalRequest(`/api/locations/${id}`), { params: Promise.resolve({ id }) }));
  } catch (err) {
    if (err instanceof RouteError && err.status === 404) notFound();
    throw err;
  }
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Ubah lokasi</h1>
      <LocationForm row={row} />
    </div>
  );
}
