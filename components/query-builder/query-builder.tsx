"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SearchSelect, type SelectOption } from "@/components/shared/search-select";
import { fieldOptions, type FieldDef } from "@/lib/org/field-value";
import type { TagCatalogItem } from "@/lib/org/field-value";

const CORE_FIELDS: SelectOption[] = [
  { value: "segmen", label: "Segmen RFM" },
  { value: "status", label: "Status kontak" },
  { value: "follow_up_status", label: "Follow-up" },
  { value: "nama", label: "Nama" },
  { value: "no_hp", label: "No. HP" },
  { value: "email", label: "Email" },
  { value: "tags", label: "Label" },
];

const OPS_TEXT: SelectOption[] = [
  { value: "eq", label: "sama dengan" },
  { value: "contains", label: "mengandung" },
];
const OPS_EQ: SelectOption[] = [{ value: "eq", label: "sama dengan" }];
const OPS_RANGE: SelectOption[] = [
  { value: "eq", label: "sama dengan" },
  { value: "gte", label: "lebih dari / sama" },
  { value: "lte", label: "kurang dari / sama" },
];
const OPS_MULTI: SelectOption[] = [{ value: "contains", label: "mengandung" }];
const OPS_TAGS: SelectOption[] = [
  { value: "contains_all", label: "berisi semua" },
  { value: "contains_any", label: "berisi salah satu" },
];

const SEGMEN: SelectOption[] = ["champions", "loyal", "potential", "at_risk", "lost", "new", "one_time"].map((v) => ({
  value: v,
  label: v,
}));
const STATUS: SelectOption[] = ["aktif", "mati", "diblokir", "opt_out"].map((v) => ({ value: v, label: v }));
const FOLLOW: SelectOption[] = ["in_progress", "waiting_callback", "closing", "failed"].map((v) => ({
  value: v,
  label: v,
}));
const BOOL: SelectOption[] = [
  { value: "true", label: "Ya" },
  { value: "false", label: "Tidak" },
];

function mapDonors(json: unknown): SelectOption[] {
  const rows = (json as { rows?: Array<{ nama_lengkap: string; no_hp_canonical: string }> }).rows ?? [];
  return rows.map((r) => ({
    value: r.nama_lengkap,
    label: `${r.nama_lengkap} · ${r.no_hp_canonical}`,
  }));
}

type Cond = { field: string; op: string; value: string };

function opsFor(field: string, extra: FieldDef[]): SelectOption[] {
  if (field === "tags") return OPS_TAGS;
  const dyn = extra.find((f) => f.slug === field);
  if (!dyn) return field === "nama" || field === "email" || field === "no_hp" ? OPS_TEXT : OPS_EQ;
  if (dyn.tipe === "multiselect") return OPS_MULTI;
  if (dyn.tipe === "number" || dyn.tipe === "date") return OPS_RANGE;
  if (dyn.tipe === "boolean" || dyn.tipe === "dropdown") return OPS_EQ;
  return OPS_TEXT;
}

function TagMultiSelect({
  catalog,
  value,
  onChange,
}: {
  catalog: TagCatalogItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
  return (
    <div className="max-h-36 overflow-auto rounded-xl border border-[#ddd] p-2">
      {catalog
        .filter((t) => t.is_active !== false)
        .map((t) => (
          <label key={t.slug} className="flex items-center gap-2 py-0.5 text-[12px]">
            <input
              type="checkbox"
              checked={selected.has(t.slug)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(t.slug);
                else next.delete(t.slug);
                onChange([...next].join(","));
              }}
            />
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.warna }} />
            {t.nama}
          </label>
        ))}
    </div>
  );
}

export function QueryBuilder({
  onResults,
  extraFields = [],
  tags = [],
}: {
  onResults: (rows: unknown[]) => void;
  extraFields?: FieldDef[];
  tags?: TagCatalogItem[];
}) {
  const [match, setMatch] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<Cond[]>([{ field: "segmen", op: "eq", value: "" }]);

  async function run() {
    const filled = conditions.filter((c) => c.field && c.value !== "");
    if (filled.length === 0) {
      toast.error("Isi minimal satu kondisi");
      return;
    }
    const res = await fetch("/api/donors/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match, conditions: filled }),
    });
    const json = await res.json();
    onResults(json.rows ?? []);
    toast.success(`${(json.rows ?? []).length} donatur`);
  }

  async function save() {
    const name = prompt("Nama segmen?");
    if (!name) return;
    await fetch("/api/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama: name, queryJson: { match, conditions } }),
    });
    toast.success("Segmen disimpan");
  }

  function patch(i: number, next: Partial<Cond>) {
    const copy = [...conditions];
    copy[i] = { ...copy[i], ...next };
    if (next.field) {
      const allowed = opsFor(next.field, extraFields);
      if (!allowed.some((o) => o.value === copy[i].op)) copy[i].op = allowed[0].value;
      copy[i].value = "";
    }
    setConditions(copy);
  }

  const fieldOptionsList = [
    ...CORE_FIELDS,
    ...extraFields.filter((f) => f.is_active).map((f) => ({ value: f.slug, label: f.label })),
  ];

  return (
    <div className="mb-3 rounded-[10px] border border-[#d9efe9] bg-white p-3 md:p-4">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[12px] font-bold text-[var(--primary)]">Filter donatur</div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f4f7f6] p-1 text-[13px]">
          <button
            type="button"
            className={`min-h-11 rounded-xl px-3 font-semibold ${match === "and" ? "bg-white text-primary shadow-sm" : "text-[#666]"}`}
            onClick={() => setMatch("and")}
          >
            Semua (AND)
          </button>
          <button
            type="button"
            className={`min-h-11 rounded-xl px-3 font-semibold ${match === "or" ? "bg-white text-primary shadow-sm" : "text-[#666]"}`}
            onClick={() => setMatch("or")}
          >
            Salah satu (OR)
          </button>
        </div>
      </div>
      {conditions.map((c, i) => {
        const dyn = extraFields.find((f) => f.slug === c.field);
        const dynOpts = dyn ? fieldOptions(dyn).map((o) => ({ value: o, label: o })) : [];
        return (
          <div key={i} className="mb-2 grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_9rem_1fr_2rem]">
            <SearchSelect
              value={c.field}
              options={fieldOptionsList}
              allowClear={false}
              onChange={(field) => patch(i, { field })}
            />
            <SearchSelect
              value={c.op}
              options={opsFor(c.field, extraFields)}
              allowClear={false}
              onChange={(op) => patch(i, { op })}
            />
            {c.field === "tags" ? (
              <TagMultiSelect catalog={tags} value={c.value} onChange={(value) => patch(i, { value })} />
            ) : c.field === "segmen" ? (
              <SearchSelect value={c.value} options={SEGMEN} placeholder="Pilih segmen" onChange={(value) => patch(i, { value })} />
            ) : c.field === "status" ? (
              <SearchSelect value={c.value} options={STATUS} placeholder="Pilih status" onChange={(value) => patch(i, { value })} />
            ) : c.field === "follow_up_status" ? (
              <SearchSelect value={c.value} options={FOLLOW} placeholder="Pilih follow-up" onChange={(value) => patch(i, { value })} />
            ) : c.field === "nama" ? (
              <SearchSelect
                value={c.value}
                loadUrl="/api/donors"
                searchParam="q"
                mapRows={mapDonors}
                placeholder="Cari nama donatur"
                onChange={(value) => patch(i, { value })}
              />
            ) : dyn?.tipe === "boolean" ? (
              <SearchSelect value={c.value} options={BOOL} placeholder="Ya / Tidak" onChange={(value) => patch(i, { value })} />
            ) : dyn?.tipe === "dropdown" || dyn?.tipe === "multiselect" ? (
              <SearchSelect value={c.value} options={dynOpts} placeholder="Pilih nilai" onChange={(value) => patch(i, { value })} />
            ) : (
              <input
                type={dyn?.tipe === "number" ? "number" : dyn?.tipe === "date" ? "date" : "text"}
                className="min-h-10 w-full rounded-xl border border-[#ddd] px-3 text-[13px]"
                value={c.value}
                placeholder="Nilai"
                onChange={(e) => patch(i, { value: e.target.value })}
              />
            )}
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#ddd] bg-white text-[13px] font-semibold text-[#c0392b] sm:h-11 sm:w-11 sm:border-0 sm:bg-transparent sm:text-[16px] sm:font-normal sm:text-[#999]"
              aria-label="Hapus kondisi"
              onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}
            >
              <span className="sm:hidden">Hapus kondisi</span>
              <span className="hidden sm:inline">×</span>
            </button>
          </div>
        );
      })}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e8e8e8] px-4 text-[13px] font-semibold sm:w-auto"
          onClick={() => setConditions([...conditions, { field: extraFields[0]?.slug || "segmen", op: "eq", value: "" }])}
        >
          + Kondisi
        </button>
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-[13px] font-semibold text-white sm:w-auto" onClick={() => void run()}>
          Jalankan
        </button>
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white sm:w-auto" onClick={() => void save()}>
          Simpan segmen
        </button>
      </div>
    </div>
  );
}
