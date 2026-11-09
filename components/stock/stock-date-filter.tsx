"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Calendar, Filter, RotateCcw } from "lucide-react";

export function StockDateFilter({
  initialStartDate,
  initialEndDate,
}: {
  initialStartDate?: string;
  initialEndDate?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [startDate, setStartDate] = useState(
    initialStartDate || searchParams.get("start_date") || ""
  );
  const [endDate, setEndDate] = useState(
    initialEndDate || searchParams.get("end_date") || ""
  );

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (startDate) {
        params.set("start_date", startDate);
      } else {
        params.delete("start_date");
      }
      if (endDate) {
        params.set("end_date", endDate);
      } else {
        params.delete("end_date");
      }
      router.push(`/stock/reports?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    startTransition(() => {
      router.push("/stock/reports");
    });
  };

  const hasFilter = Boolean(startDate || endDate);

  return (
    <form
      onSubmit={handleApply}
      className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xs text-xs"
    >
      <div className="flex items-center gap-2 text-gray-700 font-semibold">
        <Calendar size={16} className="text-[var(--primary)]" />
        <span>Filter Rentang Tanggal:</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          placeholder="Dari Tanggal"
        />
        <span className="text-gray-400">s/d</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          placeholder="Sampai Tanggal"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 font-semibold text-white shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          <Filter size={13} />
          {isPending ? "Memuat..." : "Terapkan"}
        </button>

        {hasFilter && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
      </div>

      {hasFilter && (
        <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200 ml-auto">
          Filter aktif
        </span>
      )}
    </form>
  );
}

