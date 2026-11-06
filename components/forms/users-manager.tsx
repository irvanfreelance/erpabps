"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table/data-table";
import { SearchSelect } from "@/components/shared/search-select";
import { ROLES } from "@/lib/validators/user";

type UserRow = {
  id: string;
  nama: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
};

const empty = { nama: "", email: "", password: "", role: "tim_blast", isActive: true };

export function UsersManager({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(empty);

  function startCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(row: UserRow) {
    setEditing(row);
    setForm({
      nama: row.nama,
      email: row.email,
      password: "",
      role: row.role,
      isActive: row.is_active,
    });
    setOpen(true);
  }

  async function submit() {
    const url = editing ? `/api/users/${editing.id}` : "/api/users";
    const body = editing
      ? { nama: form.nama, email: form.email, role: form.role, isActive: form.isActive, password: form.password || undefined }
      : form;
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal menyimpan pengguna");
      return;
    }
    toast.success(editing ? "Pengguna diperbarui" : "Pengguna dibuat");
    setOpen(false);
    router.refresh();
  }

  async function remove(row: UserRow) {
    if (!confirm(`Nonaktifkan dan hapus ${row.nama}?`)) return;
    const res = await fetch(`/api/users/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal menghapus");
      return;
    }
    toast.success("Pengguna dihapus");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="m-0 text-[18px] font-bold text-[var(--primary)] md:text-[20px]">Users ({rows.length})</h1>
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-xl bg-[var(--primary)] px-3.5 text-[12px] font-semibold text-white"
          onClick={startCreate}
        >
          + Tambah pengguna
        </button>
      </div>
      <DataTable
        data={rows}
        exportFilename="pengguna"
        onRow={startEdit}
        columns={[
          { key: "nama", label: "Nama" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          {
            key: "is_active",
            label: "Aktif",
            exportValue: (r) => (r.is_active ? "Ya" : "Tidak"),
          },
          { key: "last_login_at", label: "Login terakhir" },
          { key: "created_at", label: "Dibuat" },
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
            <h3 className="mt-0 mb-3 text-primary">{editing ? "Edit pengguna" : "Pengguna baru"}</h3>
            <label className="mb-1 block text-[12px]">Nama</label>
            <input
              className="mb-2 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
            />
            <label className="mb-1 block text-[12px]">Email</label>
            <input
              className="mb-2 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <label className="mb-1 block text-[12px]">{editing ? "Password baru (kosongkan jika tidak diubah)" : "Password"}</label>
            <input
              type="password"
              className="mb-2 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[13px]"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <label className="mb-1 block text-[12px]">Role</label>
            <SearchSelect
              className="mb-3"
              allowClear={false}
              value={form.role}
              options={ROLES.map((r) => ({ value: r, label: r }))}
              onChange={(role) => setForm((f) => ({ ...f, role }))}
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
