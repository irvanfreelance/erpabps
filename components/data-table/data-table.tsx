"use client";

import { ChevronLeft, ChevronRight, Columns3, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SearchSelect } from "@/components/shared/search-select";
import { btnSecondary } from "@/components/ui/button";
import { downloadXlsx } from "@/lib/utils/export-xlsx";
import { formatCell } from "@/lib/utils/format";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  exportValue?: (row: T) => string | number | null | undefined;
  className?: string;
  numeric?: boolean;
  hideable?: boolean;
  defaultHidden?: boolean;
  includeInExport?: boolean;
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

function numericClass(numeric?: boolean) {
  return numeric ? "w-px whitespace-nowrap text-right tabular-nums" : "";
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  onRow,
  selectable,
  exportFilename = "data",
}: {
  columns: Column<T>[];
  data: T[];
  onRow?: (row: T) => void;
  selectable?: boolean;
  exportFilename?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [term, setTerm] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [colsOpen, setColsOpen] = useState(false);

  const visibleColumns = useMemo(() => columns.filter((c) => !hidden.has(c.key)), [columns, hidden]);
  const exportColumns = useMemo(
    () =>
      columns.filter((c) => {
        if (c.includeInExport === false) return false;
        return !hidden.has(c.key) || c.includeInExport;
      }),
    [columns, hidden],
  );

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => {
      const rec = row as Record<string, unknown>;
      const fromCols = visibleColumns.some((c) => String(rec[c.key] ?? "").toLowerCase().includes(q));
      if (fromCols) return true;
      return Object.values(rec).some((v) => v != null && typeof v !== "object" && String(v).toLowerCase().includes(q));
    });
  }, [data, term, visibleColumns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? "");
      const bv = String((b as Record<string, unknown>)[sortKey] ?? "");
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortKey, dir]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);
  const from = total === 0 ? 0 : start + 1;
  const to = start + rows.length;

  const titleCol = visibleColumns[0];
  const restCols = visibleColumns.slice(1, 5);
  const colSpan = visibleColumns.length + 1 + (selectable ? 1 : 0);

  function goto(p: number) {
    setPage(Math.max(1, Math.min(pageCount, p)));
  }

  async function exportExcel() {
    await downloadXlsx({
      filename: exportFilename,
      sheetName: exportFilename,
      columns: exportColumns,
      rows: sorted,
    });
  }

  const searchBar = (
    <div className="flex flex-col gap-2 border-b border-[#eee] px-3 py-2.5 md:flex-row md:items-center">
      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2">
        <Search size={16} className="shrink-0 text-[#888]" />
        <input
          className="min-h-11 w-full border-0 bg-transparent text-[13px] outline-none"
          placeholder="Cari di tabel…"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
        <div className="relative">
          <button
            type="button"
            className={`${btnSecondary} w-full md:w-auto`}
            onClick={() => setColsOpen((v) => !v)}
          >
            <Columns3 size={16} />
            Kolom
          </button>
          {colsOpen && (
            <div className="absolute right-0 z-20 mt-1 max-h-64 w-56 overflow-auto rounded-xl border border-[#e5e5e5] bg-white p-2 shadow-lg">
              {columns.map((c) => (
                <label key={c.key} className="flex min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[#f6fffe]">
                  <input
                    type="checkbox"
                    checked={!hidden.has(c.key)}
                    disabled={c.hideable === false && !hidden.has(c.key) && visibleColumns.length <= 1}
                    onChange={(e) => {
                      setHidden((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.delete(c.key);
                        else if (visibleColumns.length > 1) next.add(c.key);
                        return next;
                      });
                    }}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className={`${btnSecondary} w-full md:w-auto`}
          disabled={sorted.length === 0}
          onClick={() => void exportExcel()}
        >
          <Download size={16} />
          Excel
        </button>
      </div>
    </div>
  );

  const pager = (
    <div className="flex flex-col gap-2 px-3 py-2.5 text-[13px] text-[#555] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span>
          {total === 0 ? "Tidak ada data" : `Menampilkan ${from}–${to} dari ${total}`}
        </span>
        <label className="inline-flex items-center gap-2">
          <span className="text-[#888]">Baris</span>
          <SearchSelect
            className="w-[5.5rem]"
            placement="top"
            allowClear={false}
            value={String(pageSize)}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          />
        </label>
      </div>
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 sm:flex sm:justify-end">
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#ddd] bg-white disabled:opacity-40"
          disabled={safePage <= 1}
          onClick={() => goto(safePage - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-[4.5rem] px-1 text-center text-[13px] font-semibold">
          {safePage} / {pageCount}
        </span>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#ddd] bg-white disabled:opacity-40"
          disabled={safePage >= pageCount}
          onClick={() => goto(safePage + 1)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-[10px] bg-white shadow-sm md:hidden">
        {searchBar}
        <div className="space-y-2 p-2">
          {rows.length === 0 && (
            <div className="px-3 py-8 text-center text-[#999]">Tidak ada data</div>
          )}
          {rows.map((row, i) => {
            const id = String(row.id ?? start + i);
            const Tag = onRow ? "button" : "div";
            return (
              <Tag
                key={id}
                type={onRow ? "button" : undefined}
                onClick={() => onRow?.(row)}
                className="block w-full rounded-xl bg-[#f8f9fa] p-3 text-left"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-[11px] font-bold text-[#888]">{start + i + 1}.</span>
                  <div className="min-w-0 text-[14px] font-normal text-[#5c5c5c]">
                    {titleCol?.render ? titleCol.render(row) : formatCell((row as Record<string, unknown>)[titleCol?.key ?? ""])}
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  {restCols.map((c) => (
                    <div key={c.key} className={c.numeric ? "min-w-0 text-right" : "min-w-0"}>
                      <dt className="text-[11px] font-medium text-[#8a8a8a]">{c.label}</dt>
                      <dd className={`mt-0.5 text-[13px] font-normal text-[#5c5c5c] ${c.numeric ? "whitespace-nowrap tabular-nums" : "truncate"}`}>
                        {c.render ? c.render(row) : formatCell((row as Record<string, unknown>)[c.key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Tag>
            );
          })}
        </div>
        {pager}
      </div>
      <div className="hidden overflow-hidden rounded-[10px] bg-white shadow-sm md:block">
        {searchBar}
        <div className="overflow-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-white">
                {selectable && <th className="w-10 bg-[var(--primary)] px-3 py-2.5" />}
                <th className="w-12 bg-[var(--primary)] px-3 py-2.5">No</th>
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    className={`cursor-pointer bg-[var(--primary)] px-3 py-2.5 ${numericClass(c.numeric)} ${c.className ?? ""}`}
                    onClick={() => {
                      setSortKey(c.key);
                      setDir((d) => (sortKey === c.key && d === "asc" ? "desc" : "asc"));
                      setPage(1);
                    }}
                  >
                    <span className={`inline-flex min-h-6 items-center gap-1 ${c.numeric ? "w-full justify-end" : ""}`}>
                      {c.label}
                      {sortKey === c.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const id = String(row.id ?? start + i);
                return (
                  <tr
                    key={id}
                    onClick={() => onRow?.(row)}
                    className={`border-b border-[#f0f0f0] ${onRow ? "cursor-pointer hover:bg-[#f6fffe]" : ""}`}
                  >
                    {selectable && (
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.has(id)}
                          onChange={(e) => {
                            const next = new Set(checked);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            setChecked(next);
                          }}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 tabular-nums text-[#888]">{start + i + 1}</td>
                    {visibleColumns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 font-normal text-[#5c5c5c] ${numericClass(c.numeric)}`}>
                        {c.render ? c.render(row) : formatCell((row as Record<string, unknown>)[c.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-[#999]">
                    Tidak ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pager}
      </div>
    </>
  );
}
