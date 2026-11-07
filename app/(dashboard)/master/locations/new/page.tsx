import { LocationForm } from "@/components/hrd/location-form";

export const metadata = { title: "Lokasi baru — ABPS" };

export default function Page() {
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Lokasi baru</h1>
      <LocationForm />
    </div>
  );
}
