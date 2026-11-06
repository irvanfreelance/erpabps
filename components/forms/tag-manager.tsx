"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import type { TagCatalogItem } from "@/lib/org/field-value";

type TagDef = TagCatalogItem & { id: string; deskripsi: string | null; is_active: boolean };

const empty = { nama: "", warna: "#01665a", deskripsi: "", isActive: true };

export function TagManager({ rows }: { rows: TagDef[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TagDef | null>(null);
  const [form, setForm] = useState(empty);

  function startCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(row: TagDef) {
    setEditing(row);
    setForm({
      nama: row.nama,
      warna: row.warna,
      deskripsi: row.deskripsi ?? "",
      isActive: row.is_active,
    });
    setOpen(true);
  }

  async function submit() {
    const url = editing ? `/api/tags/${editing.id}` : "/api/tags";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan tag");
      return;
    }
    toast.success(editing ? "Tag diperbarui" : "Tag dibuat");
    setOpen(false);
    router.refresh();
  }

  async function remove(row: TagDef) {
    if (!confirm(`Hapus atau nonaktifkan tag ${row.nama}?`)) return;
    const res = await fetch(`/api/tags/${row.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) toast.error("Gagal menghapus");
    else {
      toast.success(json.deactivated ? `Dinonaktifkan (masih dipakai ${json.used} donatur)` : "Tag dihapus");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-[18px] font-bold text-[var(--primary)] md:text-[20px]">Label donatur ({rows.length})</h1>
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-xl bg-[var(--primary)] px-3.5 text-[12px] font-semibold text-white"
          onClick={startCreate}
        >
          + Tambah label
        </button>
      </div>
      <DataTable
        data={rows}
        exportFilename="label-donatur"
        onRow={startEdit}
        columns={[
          { key: "nama", label: "Nama" },
          { key: "slug", label: "Slug" },
          {
            key: "warna",
            label: "Warna",
            render: (r) => (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded-full" style={{ background: r.warna }} />
                {r.warna}
              </span>
            ),
          },
          {
            key: "is_active",
            label: "Status",
            exportValue: (r) => (r.is_active ? "aktif" : "nonaktif"),
          },
          { key: "deskripsi", label: "Deskripsi" },
          {
            key: "aksi",
            label: "Aksi",
            includeInExport: false,
            render: (r) => (
              <button
                type="button"
                className="text-[12px] font-semibold text-[#c0392b]"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(r);
                }}
              >
                Hapus
              </button>
            ),
          },
        ]}
      />
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-xl bg-white p-5 sm:max-w-[420px] sm:rounded-xl">
            <h3 className="mt-0 mb-3 text-primary">{editing ? "Edit label" : "Label baru"}</h3>
            <label className="mb-1 block text-[12px]">Nama</label>
            <input
              className="mb-2 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
            />
            <label className="mb-1 block text-[12px]">Warna</label>
            <input
              type="color"
              className="mb-2 h-10 w-full rounded-xl border border-[#ddd]"
              value={form.warna}
              onChange={(e) => setForm((f) => ({ ...f, warna: e.target.value }))}
            />
            <label className="mb-1 block text-[12px]">Deskripsi</label>
            <input
              className="mb-3 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
              value={form.deskripsi}
              onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
            />
            <label className="mb-4 inline-flex items-center gap-1.5 text-[13px]">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Aktif
            </label>
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
