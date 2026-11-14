"use client";

import { Check, ChevronLeft, ChevronRight, Download, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { SearchSelect } from "@/components/shared/search-select";
import { btnSecondary } from "@/components/ui/button";
import { downloadXlsx } from "@/lib/utils/export-xlsx";
import { fmtRp, formatCell } from "@/lib/utils/format";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  exportValue?: (row: T) => string | number | null | undefined;
  className?: string;
  numeric?: boolean;
  money?: boolean;
  hideable?: boolean;
  defaultHidden?: boolean;
  includeInExport?: boolean;
  sticky?: "left" | "right";
  width?: string;
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

const CHECK_W = 40;
const NO_W = 48;

function numericClass(numeric?: boolean, money?: boolean) {
  return numeric || money ? "w-px whitespace-nowrap text-right tabular-nums" : "whitespace-nowrap";
}

function parseWidthPx(width?: string) {
  if (!width) return 160;
  const n = Number.parseFloat(width);
  if (!Number.isFinite(n)) return 160;
  if (width.endsWith("rem")) return n * 16;
  return n;
}

function stickyOffsets<T>(selectable: boolean, cols: Column<T>[]) {
  const left = new Map<string, number>();
  const right = new Map<string, number>();
  let acc = 0;
  if (selectable) {
    left.set("__check", 0);
    acc += CHECK_W;
  }
  left.set("__no", acc);
  acc += NO_W;
  for (const c of cols) {
    if (c.sticky !== "left") continue;
    left.set(c.key, acc);
    acc += parseWidthPx(c.width);
  }
  acc = 0;
  for (const c of [...cols].reverse()) {
    if (c.sticky !== "right") continue;
    right.set(c.key, acc);
    acc += parseWidthPx(c.width);
  }
  return { left, right };
}

function stickyClass(side: "left" | "right" | undefined, isHeader: boolean, edge: boolean) {
  if (!side) return "";
  const bg = isHeader ? "bg-[var(--primary)]" : "bg-white group-hover:bg-[#f6fffe]";
  const z = isHeader ? "z-50" : "z-10";
  const top = isHeader ? "top-0" : "";
  const shadow =
    edge && side === "left"
      ? "shadow-[2px_0_6px_rgba(0,0,0,0.08)]"
      : edge && side === "right"
        ? "shadow-[-2px_0_6px_rgba(0,0,0,0.08)]"
        : "";
  return `sticky ${top} ${bg} ${z} ${shadow}`;
}

function cellText<T>(c: Column<T>, row: T) {
  if (c.render) return c.render(row);
  const raw = (row as Record<string, unknown>)[c.key];
  if (c.money) return fmtRp(raw as string | number | null);
  return formatCell(raw);
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
  const offsets = useMemo(() => stickyOffsets(!!selectable, visibleColumns), [selectable, visibleColumns]);
  const lastLeftKey = [...visibleColumns].reverse().find((c) => c.sticky === "left")?.key;
  const firstRightKey = visibleColumns.find((c) => c.sticky === "right")?.key;
  const freezeNo = visibleColumns.some((c) => c.sticky === "left" || c.sticky === "right");
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
      <div className="flex md:shrink-0">
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white disabled:opacity-40"
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent)] text-white disabled:opacity-40"
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
                    {titleCol ? cellText(titleCol, row) : null}
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  {restCols.map((c) => (
                    <div key={c.key} className={c.numeric || c.money ? "min-w-0 text-right" : "min-w-0"}>
                      <dt className="text-[11px] font-medium text-[#8a8a8a]">{c.label}</dt>
                      <dd className={`mt-0.5 text-[13px] font-normal text-[#5c5c5c] ${c.numeric || c.money ? "whitespace-nowrap tabular-nums" : "truncate"}`}>
                        {cellText(c, row)}
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
        <div className="max-h-[min(70vh,calc(100vh-16rem))] overflow-auto">
          <table className="w-max min-w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-40">
              <tr className="text-left text-[12px] font-semibold text-white">
                <th className="relative w-10 bg-[var(--primary)] px-2.5 py-2.5">
                  <button
                    type="button"
                    aria-label="Atur kolom"
                    onClick={() => setColsOpen((v) => !v)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-white/85 hover:bg-white/15 hover:text-white"
                  >
                    <SlidersHorizontal size={15} />
                  </button>
                  {colsOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-2 text-left font-normal text-slate-700 shadow-lg">
                      <div className="mb-1.5 flex items-center justify-between border-b border-slate-100 px-2 pb-1.5">
                        <span className="text-[11px] font-semibold tracking-wider text-slate-400">
                          KOLOM
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setHidden(new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)))
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"
                        >
                          <RotateCcw size={11} />
                          Reset
                        </button>
                      </div>
                      <div className="max-h-64 space-y-0.5 overflow-auto">
                        {columns.map((c) => {
                          const isChecked = !hidden.has(c.key);
                          const isDisabled =
                            c.hideable === false || (isChecked && visibleColumns.length <= 1);
                          return (
                            <label
                              key={c.key}
                              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] ${
                                isDisabled
                                  ? "cursor-not-allowed text-slate-400"
                                  : "cursor-pointer hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={(e) => {
                                  setHidden((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.delete(c.key);
                                    else if (visibleColumns.length > 1) next.add(c.key);
                                    return next;
                                  });
                                }}
                              />
                              <span
                                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                  isChecked
                                    ? isDisabled
                                      ? "border-slate-300 bg-slate-300 text-white"
                                      : "border-[var(--primary)] bg-[var(--primary)] text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isChecked && <Check size={12} strokeWidth={3} />}
                              </span>
                              <span className="truncate">{c.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </th>
                {selectable && (
                  <th
                    className={`w-10 bg-[var(--primary)] px-3 py-2.5 ${freezeNo ? stickyClass("left", true, false) : "bg-[var(--primary)]"}`}
                    style={freezeNo ? { left: offsets.left.get("__check") ?? 0, minWidth: CHECK_W, width: CHECK_W } : undefined}
                  />
                )}
                <th
                  className={`w-12 bg-[var(--primary)] px-3 py-2.5 whitespace-nowrap ${freezeNo ? stickyClass("left", true, !lastLeftKey) : ""}`}
                  style={freezeNo ? { left: offsets.left.get("__no") ?? 0, minWidth: NO_W, width: NO_W } : undefined}
                >
                  No
                </th>
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    className={`cursor-pointer bg-[var(--primary)] px-3 py-2.5 ${numericClass(c.numeric, c.money)} ${c.className ?? ""} ${stickyClass(c.sticky, true, c.key === lastLeftKey || c.key === firstRightKey)}`}
                    style={{
                      minWidth: c.width,
                      width: c.width,
                      ...(c.sticky === "left" ? { left: offsets.left.get(c.key) } : {}),
                      ...(c.sticky === "right" ? { right: offsets.right.get(c.key) } : {}),
                    }}
                    onClick={() => {
                      setSortKey(c.key);
                      setDir((d) => (sortKey === c.key && d === "asc" ? "desc" : "asc"));
                      setPage(1);
                    }}
                  >
                    <span className={`inline-flex min-h-6 items-center gap-1 ${c.numeric || c.money ? "w-full justify-end" : ""}`}>
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
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a")) return;
                      onRow?.(row);
                    }}
                    className={`group border-b border-[#f0f0f0] ${onRow ? "cursor-pointer hover:bg-[#f6fffe]" : ""}`}
                  >
                    <td className="w-10 px-2.5 py-2" />
                    {selectable && (
                      <td
                        className={`px-3 py-2 ${freezeNo ? stickyClass("left", false, false) : ""}`}
                        style={freezeNo ? { left: offsets.left.get("__check") ?? 0, minWidth: CHECK_W, width: CHECK_W } : undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    <td
                      className={`px-3 py-2 tabular-nums whitespace-nowrap text-[#888] ${freezeNo ? stickyClass("left", false, !lastLeftKey) : ""}`}
                      style={freezeNo ? { left: offsets.left.get("__no") ?? 0, minWidth: NO_W, width: NO_W } : undefined}
                    >
                      {start + i + 1}
                    </td>
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-2 font-normal text-[#5c5c5c] ${numericClass(c.numeric, c.money)} ${stickyClass(c.sticky, false, c.key === lastLeftKey || c.key === firstRightKey)}`}
                        style={{
                          minWidth: c.width,
                          width: c.width,
                          ...(c.sticky === "left" ? { left: offsets.left.get(c.key) } : {}),
                          ...(c.sticky === "right" ? { right: offsets.right.get(c.key) } : {}),
                        }}
                      >
                        {cellText(c, row)}
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
