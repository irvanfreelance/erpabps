"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { btnPrimary, btnSecondary } from "@/components/ui/button";
import type { LocationRow } from "@/components/hrd/locations-workspace";

const LocationMap = dynamic(() => import("./location-map").then((m) => m.LocationMap), { ssr: false });

type Suggest = { label: string; latitude: number; longitude: number };

function toNum(v: string | number | null | undefined) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function LocationForm({ row }: { row?: LocationRow }) {
  const router = useRouter();
  const [form, setForm] = useState({
    code: row?.code ?? "",
    name: row?.name ?? "",
    address: row?.address ?? "",
    latitude: toNum(row?.latitude),
    longitude: toNum(row?.longitude),
    radiusMeter: Math.min(500, Math.max(10, Number(row?.radius_meter) || 100)),
  });
  const [q, setQ] = useState(row?.address ?? "");
  const [suggests, setSuggests] = useState<Suggest[]>([]);
  const [pending, setPending] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSuggest = useRef(false);

  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    if (skipSuggest.current) {
      skipSuggest.current = false;
      return;
    }
    if (q.trim().length < 2) {
      setSuggests([]);
      return;
    }
    t.current = setTimeout(async () => {
      const res = await fetch(`/api/locations/geocode?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json().catch(() => ({ results: [] }));
      setSuggests((json.results as Suggest[]) ?? []);
    }, 700);
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, [q]);

  function pickPlace(s: Suggest) {
    skipSuggest.current = true;
    setForm((f) => ({ ...f, address: s.label, latitude: s.latitude, longitude: s.longitude }));
    setQ(s.label);
    setSuggests([]);
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Kode dan nama wajib");
      return;
    }
    setPending(true);
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      address: form.address.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      radiusMeter: form.radiusMeter,
    };
    const res = await fetch(row?.id ? `/api/locations/${row.id}` : "/api/locations", {
      method: row?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal menyimpan");
      return;
    }
    toast.success("Tersimpan");
    router.push("/master/locations");
    router.refresh();
  }

  return (
    <form
      className="grid max-w-3xl gap-2 rounded-xl border border-[#eee] bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-[12px] font-semibold text-[#555]">
          Kode
          <input className="min-h-11 rounded-xl border border-[#ddd] px-3 text-[13px] font-normal" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </label>
        <label className="grid gap-1 text-[12px] font-semibold text-[#555]">
          Nama
          <input className="min-h-11 rounded-xl border border-[#ddd] px-3 text-[13px] font-normal" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
      </div>
      <label className="grid gap-1 text-[12px] font-semibold text-[#555]">
        <span className="flex items-center justify-between">
          Radius
          <span className="tabular-nums font-normal text-[#777]">{form.radiusMeter} m</span>
        </span>
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          className="h-11 w-full accent-[var(--primary)]"
          value={form.radiusMeter}
          onChange={(e) => setForm({ ...form, radiusMeter: Number(e.target.value) })}
        />
        <span className="flex justify-between text-[11px] font-normal text-[#999]">
          <span>10 m</span>
          <span>500 m</span>
        </span>
      </label>
      <label className="relative grid gap-1 text-[12px] font-semibold text-[#555]">
        Cari tempat
        <input
          className="min-h-11 rounded-xl border border-[#ddd] px-3 text-[13px] font-normal"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ketik nama tempat"
        />
        {suggests.length > 0 ? (
          <ul className="absolute top-full z-[1000] mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[#ddd] bg-white text-[13px] font-normal shadow">
            {suggests.map((s) => (
              <li key={`${s.latitude}-${s.longitude}-${s.label}`}>
                <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#f4f5f7]" onClick={() => pickPlace(s)}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>
      <label className="grid gap-1 text-[12px] font-semibold text-[#555]">
        Alamat
        <input className="min-h-11 rounded-xl border border-[#ddd] px-3 text-[13px] font-normal" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </label>
      <p className="text-[12px] text-[#777]">Klik peta atau geser penanda untuk menandai lokasi.</p>
      <LocationMap
        latitude={form.latitude}
        longitude={form.longitude}
        radiusMeter={form.radiusMeter}
        onPick={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
      />
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={pending} type="submit">
          Simpan
        </button>
        <Link href="/master/locations" className={btnSecondary}>
          Batal
        </Link>
      </div>
    </form>
  );
}
