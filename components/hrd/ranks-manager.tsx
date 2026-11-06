"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { btnDangerSm, btnPrimary, btnSecondary } from "@/components/ui/button";

type Row = { id: string; code: string; name: string; sort_order: number };

export function RanksManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", name: "", sortOrder: "0" });
  const [editing, setEditing] = useState<string | null>(null);

  async function save() {
    const url = editing ? `/api/ranks/${editing}` : "/api/ranks";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: form.code, name: form.name, sortOrder: Number(form.sortOrder) || 0 }),
    });
    if (!res.ok) {
      toast.error("Gagal menyimpan pangkat");
      return;
    }
    toast.success("Tersimpan");
    setEditing(null);
    setForm({ code: "", name: "", sortOrder: "0" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!(await confirmAction("Hapus pangkat ini?", "Hapus"))) return;
    const res = await fetch(`/api/ranks/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Gagal");
    else {
      toast.success("Diarsipkan");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-3 grid max-w-xl gap-2 rounded-xl border bg-white p-3">
        <input className="min-h-11 rounded-xl border px-3" placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input className="min-h-11 rounded-xl border px-3" placeholder="Nama pangkat" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="min-h-11 rounded-xl border px-3" placeholder="Urutan" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} onClick={save}>
            {editing ? "Ubah" : "Tambah"}
          </button>
          {editing && (
            <button type="button" className={btnSecondary} onClick={() => { setEditing(null); setForm({ code: "", name: "", sortOrder: "0" }); }}>
              Batal
            </button>
          )}
        </div>
      </div>
      <DataTable
        data={rows}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "sort_order", label: "Urutan", numeric: true },
          {
            key: "id",
            label: "Aksi",
            render: (r) => (
              <div className="flex gap-2">
                <button type="button" className="text-[var(--primary)]" onClick={() => { setEditing(r.id); setForm({ code: r.code, name: r.name, sortOrder: String(r.sort_order) }); }}>
                  Ubah
                </button>
                <button type="button" className={btnDangerSm} onClick={() => remove(r.id)}>
                  Hapus
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
