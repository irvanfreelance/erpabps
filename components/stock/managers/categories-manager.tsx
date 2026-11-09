"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye } from "lucide-react";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnPrimarySm, btnDangerSm, btnSecondarySm, btnPrimary, btnSecondary } from "@/components/ui/button";

export type CategoryRow = {
  id: string;
  code: string;
  name: string;
  item_count: number;
};

export function CategoriesManager({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setModalOpen(true);
  };

  const openEdit = (row: CategoryRow) => {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Kode dan nama kategori wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const url = editingId ? `/api/stock/categories/${editingId}` : "/api/stock/categories";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan data");

      toast.success(editingId ? "Kategori berhasil diperbarui" : "Kategori berhasil ditambahkan");
      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: CategoryRow) => {
    if (row.item_count > 0) {
      toast.error(`Kategori ${row.name} masih digunakan oleh ${row.item_count} barang`);
      return;
    }
    const ok = await confirmAction(`Hapus kategori "${row.name}"?`, "Hapus");
    if (!ok) return;

    try {
      const res = await fetch(`/api/stock/categories/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");

      toast.success("Kategori berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAdd} className={`${btnPrimarySm} gap-1.5`}>
          <Plus size={14} /> Tambah Kategori
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="Kategori Barang"
        columns={[
          { key: "code", label: "Kode", render: (r) => <span className="font-semibold">{r.code}</span> },
          { key: "name", label: "Nama Kategori" },
          { key: "item_count", label: "Jumlah Item", numeric: true },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100"
                  title="Edit Kategori"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  title="Hapus Kategori"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ),
          },
        ]}
      />

      {modalOpen && (
        <Modal
          title={editingId ? "Edit Kategori Barang" : "Tambah Kategori Barang"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kode Kategori</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Misal: RAW, SEMI, FINISHED"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Kategori</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Bahan Baku Mentah, Olahan"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={btnSecondary}
                disabled={loading}
              >
                Batal
              </button>
              <button
                type="submit"
                className={btnPrimary}
                disabled={loading}
              >
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
