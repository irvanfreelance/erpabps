"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Filter, RotateCcw } from "lucide-react";

type Opt = { id: string; label: string };

export function MovesFilter({
  items,
  bins,
  initial,
}: {
  items: Opt[];
  bins: Opt[];
  initial: { start_date?: string; end_date?: string; item_id?: string; bin_id?: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(initial.start_date || "");
  const [endDate, setEndDate] = useState(initial.end_date || "");
  const [itemId, setItemId] = useState(initial.item_id || "");
  const [binId, setBinId] = useState(initial.bin_id || "");

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      const set = (key: string, value: string) => {
        if (value) params.set(key, value);
        else params.delete(key);
      };
      set("start_date", startDate);
      set("end_date", endDate);
      set("item_id", itemId);
      set("bin_id", binId);
      const q = params.toString();
      router.push(q ? `/stock/moves?${q}` : "/stock/moves");
    });
  };

  const reset = () => {
    setStartDate("");
    setEndDate("");
    setItemId("");
    setBinId("");
    startTransition(() => router.push("/stock/moves"));
  };

  const active = Boolean(startDate || endDate || itemId || binId);

  return (
    <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-gray-200 bg-white p-3 text-xs">
      <label className="flex flex-col gap-1 font-semibold text-gray-600">
        Dari
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 font-normal" />
      </label>
      <label className="flex flex-col gap-1 font-semibold text-gray-600">
        Sampai
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 font-normal" />
      </label>
      <label className="flex min-w-40 flex-col gap-1 font-semibold text-gray-600">
        Barang
        <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 font-normal">
          <option value="">Semua barang</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1 font-semibold text-gray-600">
        Bin
        <select value={binId} onChange={(e) => setBinId(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 font-normal">
          <option value="">Semua bin</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>{bin.label}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 font-semibold text-white">
        <Filter size={13} /> {pending ? "Memuat..." : "Terapkan"}
      </button>
      {active && (
        <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-600">
          <RotateCcw size={12} /> Reset
        </button>
      )}
    </form>
  );
}
