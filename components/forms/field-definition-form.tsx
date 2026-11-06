"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { SearchSelect } from "@/components/shared/search-select";
import { Badge } from "@/components/shared/badge";
import { FIELD_TYPES } from "@/lib/validators/field-definition";
import type { FieldDef } from "@/lib/org/field-value";
import { fieldOptions } from "@/lib/org/field-value";

const SURFACES = ["profil", "list", "export"] as const;

const empty = {
  slug: "",
  label: "",
  tipe: "text",
  optionsText: "",
  isRequired: false,
  isSearchable: true,
  isActive: true,
  visible: ["profil", "list", "export"] as string[],
  sortOrder: 0,
};

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);
}

export function FieldDefinitionsManager({ rows }: { rows: FieldDef[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [form, setForm] = useState(empty);

  function startCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(row: FieldDef) {
    setEditing(row);
    setForm({
      slug: row.slug,
      label: row.label,
      tipe: row.tipe,
      optionsText: fieldOptions(row).join("\n"),
      isRequired: row.is_required,
      isSearchable: row.is_searchable,
      isActive: row.is_active,
      visible: Array.isArray(row.visible_in_json) ? row.visible_in_json.map(String) : [...SURFACES],
      sortOrder: Number(row.sort_order ?? 0),
    });
    setOpen(true);
  }

  const payload = useMemo(
    () => ({
      slug: form.slug,
      label: form.label,
      tipe: form.tipe,
      optionsJson: form.optionsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      isRequired: form.isRequired,
      isSearchable: form.isSearchable,
      isActive: form.isActive,
      visibleInJson: form.visible,
      sortOrder: form.sortOrder,
    }),
    [form],
  );

  async function submit() {
    const url = editing ? `/api/field-definitions/${editing.id}` : "/api/field-definitions";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan field");
      return;
    }
    toast.success(editing ? "Field diperbarui" : "Field dibuat");
    setOpen(false);
    router.refresh();
  }

  async function deactivate(row: FieldDef) {
    if (!confirm(`Nonaktifkan field ${row.label}? Nilai donatur tetap tersimpan.`)) return;
    const res = await fetch(`/api/field-definitions/${row.id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Gagal menonaktifkan");
    else {
      toast.success("Field dinonaktifkan");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-[18px] font-bold text-[var(--primary)] md:text-[20px]">
          Dynamic Fields ({rows.length})
        </h1>
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-xl bg-[var(--primary)] px-3.5 text-[12px] font-semibold text-white"
          onClick={startCreate}
        >
          + Tambah field
        </button>
      </div>
      <DataTable
        data={rows}
        exportFilename="field-dinamis"
        onRow={startEdit}
        columns={[
          { key: "slug", label: "Slug" },
          { key: "label", label: "Label" },
          { key: "tipe", label: "Tipe" },
          {
            key: "is_active",
            label: "Status",
            render: (r) => <Badge color={r.is_active ? "#01665a" : "#95a5a6"}>{r.is_active ? "aktif" : "nonaktif"}</Badge>,
            exportValue: (r) => (r.is_active ? "aktif" : "nonaktif"),
          },
          {
            key: "visible_in_json",
            label: "Tampil di",
            render: (r) => (Array.isArray(r.visible_in_json) ? r.visible_in_json.join(", ") : "—"),
            exportValue: (r) => (Array.isArray(r.visible_in_json) ? r.visible_in_json.join(", ") : ""),
          },
          {
            key: "is_searchable",
            label: "Searchable",
            exportValue: (r) => (r.is_searchable ? "Ya" : "Tidak"),
          },
          {
            key: "aksi",
            label: "Aksi",
            render: (r) => (
              <button
                type="button"
                className="text-[12px] font-semibold text-[#c0392b]"
                onClick={(e) => {
                  e.stopPropagation();
                  void deactivate(r);
                }}
              >
                Nonaktifkan
              </button>
            ),
            includeInExport: false,
          },
        ]}
      />
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-auto rounded-t-xl bg-white p-5 sm:max-w-[520px] sm:rounded-xl">
            <h3 className="mt-0 mb-3 text-primary">{editing ? "Edit field" : "Field baru"}</h3>
            <label className="mb-1 block text-[12px]">Label</label>
            <input
              className="mb-2 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  label: e.target.value,
                  slug: editing ? f.slug : slugify(e.target.value),
                }))
              }
            />
            <label className="mb-1 block text-[12px]">Slug (kunci, tidak diubah setelah dibuat)</label>
            <input
              className="mb-2 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px] disabled:bg-[#f5f5f5]"
              value={form.slug}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
            />
            <label className="mb-1 block text-[12px]">Tipe</label>
            <SearchSelect
              className="mb-2"
              allowClear={false}
              value={form.tipe}
              options={FIELD_TYPES.map((t) => ({ value: t, label: t }))}
              onChange={(v) => setForm((f) => ({ ...f, tipe: v }))}
            />
            {(form.tipe === "dropdown" || form.tipe === "multiselect") && (
              <>
                <label className="mb-1 block text-[12px]">Opsi (satu per baris)</label>
                <textarea
                  className="mb-2 min-h-24 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
                  value={form.optionsText}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                />
              </>
            )}
            <label className="mb-1 block text-[12px]">Urutan</label>
            <input
              type="number"
              className="mb-2 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
            <div className="mb-2 text-[12px] font-bold text-[#555]">Tampil di</div>
            <div className="mb-3 flex flex-wrap gap-3 text-[13px]">
              {SURFACES.map((s) => (
                <label key={s} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.visible.includes(s)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        visible: e.target.checked ? [...f.visible, s] : f.visible.filter((x) => x !== s),
                      }))
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-4 text-[13px]">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isRequired}
                  onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))}
                />
                Wajib
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isSearchable}
                  onChange={(e) => setForm((f) => ({ ...f, isSearchable: e.target.checked }))}
                />
                Bisa dicari
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Aktif
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-xl px-3 py-1.5" onClick={() => setOpen(false)}>
                Batal
              </button>
              <button type="button" className="rounded-xl bg-primary px-3 py-1.5 text-white" onClick={() => void submit()}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
