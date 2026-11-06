"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

export type SelectOption = { value: string; label: string };

function defaultMapRows(json: unknown): SelectOption[] {
  const rec = json as { rows?: Array<Record<string, unknown>> };
  const rows = Array.isArray(json) ? json : (rec.rows ?? []);
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    value: String(r.value ?? r.id ?? r.slug ?? ""),
    label: String(r.label ?? r.nama_lengkap ?? r.nama ?? r.email ?? r.id ?? ""),
  }));
}

export function SearchSelect({
  value,
  onChange,
  options: staticOptions,
  loadUrl,
  searchParam,
  mapRows = defaultMapRows,
  placeholder = "Pilih…",
  allowClear = true,
  className,
  disabled,
  placement = "bottom",
}: {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  loadUrl?: string;
  searchParam?: string;
  mapRows?: (json: unknown) => SelectOption[];
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  disabled?: boolean;
  placement?: "bottom" | "top";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; bottom: number } | null>(null);
  const mapRef = useRef(mapRows);
  mapRef.current = mapRows;

  const source = staticOptions ?? remote;

  useEffect(() => {
    if (!loadUrl) return;
    if (searchParam) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(loadUrl);
        const json = await res.json();
        if (!cancelled) setRemote(mapRef.current(json));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUrl, searchParam]);

  useEffect(() => {
    if (!loadUrl || !searchParam || !open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL(loadUrl, window.location.origin);
        if (q) url.searchParams.set(searchParam, q);
        const res = await fetch(url.toString());
        const json = await res.json();
        setRemote(mapRef.current(json));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [loadUrl, searchParam, q, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (root.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    function place() {
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (searchParam) return source;
    const n = q.trim().toLowerCase();
    if (!n) return source;
    return source.filter((o) => o.label.toLowerCase().includes(n) || o.value.toLowerCase().includes(n));
  }, [source, q, searchParam]);

  const selected = source.find((o) => o.value === value) ?? staticOptions?.find((o) => o.value === value);

  return (
    <div ref={root} className={cn("relative min-w-0", open && "z-[80]", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 rounded-2xl border-0 bg-[#f3f5f4] px-3 text-left text-[13px] shadow-none outline-none ring-0 disabled:opacity-50"
      >
        <span className={cn("min-w-0 flex-1 truncate font-normal", selected ? "text-[#5c5c5c]" : "text-[#999]")}>
          {selected?.label ?? placeholder}
        </span>
        {allowClear && value ? (
          <span
            role="button"
            tabIndex={-1}
            className="rounded-lg p-0.5 text-[#888] hover:bg-[#f0f0f0]"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            <X size={14} />
          </span>
        ) : (
          <ChevronDown size={16} className="shrink-0 text-[#888]" />
        )}
      </button>
      {open &&
        box &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[300] min-w-[200px] overflow-hidden rounded-2xl border-0 bg-[#f7f8f8] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
            style={{
              left: Math.min(box.left, window.innerWidth - Math.max(box.width, 200) - 8),
              width: Math.max(box.width, 200),
              ...(placement === "top" || window.innerHeight - box.bottom < 200
                ? { bottom: window.innerHeight - box.top + 4 }
                : { top: box.bottom + 4 }),
            }}
          >
            <div className="flex items-center gap-2 rounded-xl bg-white/80 px-2 py-1.5">
              <Search size={14} className="text-[#888]" />
              <input
                ref={inputRef}
                className="min-h-8 w-full border-0 bg-transparent text-[13px] outline-none ring-0"
                placeholder="Ketik untuk mencari…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filtered[0]) {
                    onChange(filtered[0].value);
                    setOpen(false);
                  }
                }}
              />
            </div>
            <ul className="mt-1 max-h-56 overflow-auto">
              {loading && <li className="px-3 py-2 text-[12px] text-[#888]">Memuat…</li>}
              {!loading && filtered.length === 0 && (
                <li className="px-3 py-2 text-[12px] text-[#888]">Tidak ada hasil</li>
              )}
              {filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-xl border-0 px-3 py-2 text-left text-[13px] hover:bg-white",
                      o.value === value && "bg-white font-semibold text-[var(--primary)]",
                    )}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
