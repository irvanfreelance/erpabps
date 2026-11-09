"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnPrimarySm, btnPrimary, btnSecondary } from "@/components/ui/button";

export type ItemRow = {
  id: string;
  sku: string;
  name: string;
  item_kind: string;
  category_id: string;
  category_name: string;
  uom_id: string;
  uom_code: string;
  is_stocked: boolean;
};

export type CategoryOpt = { id: string; name: string };
export type UomOpt = { id: string; code: string; name: string };

export function ItemsManager({
  rows,
  categories,
  uoms,
}: {
  rows: ItemRow[];
  categories: CategoryOpt[];
  uoms: UomOpt[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [uomId, setUomId] = useState(uoms[0]?.id || "");
  const [itemKind, setItemKind] = useState("raw_material");
  const [isStocked, setIsStocked] = useState(true);
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setSku("");
    setName("");
    setCategoryId(categories[0]?.id || "");
    setUomId(uoms[0]?.id || "");
    setItemKind("raw_material");
    setIsStocked(true);
    setModalOpen(true);
  };

  const openEdit = (row: ItemRow) => {
    setEditingId(row.id);
    setSku(row.sku);
    setName(row.name);
    setCategoryId(row.category_id);
    setUomId(row.uom_id);
    setItemKind(row.item_kind);
    setIsStocked(Boolean(row.is_stocked));
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim() || !categoryId || !uomId) {
      toast.error("SKU, nama barang, kategori, dan satuan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const url = editingId ? `/api/stock/items/${editingId}` : "/api/stock/items";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: sku.trim(),
          name: name.trim(),
          category_id: categoryId,
          uom_id: uomId,
          item_kind: itemKind,
          is_stocked: isStocked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan data");

      toast.success(editingId ? "Barang berhasil diperbarui" : "Barang berhasil ditambahkan");
      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: ItemRow) => {
    const ok = await confirmAction(`Hapus barang "${row.name}" (${row.sku})?`, "Hapus");
    if (!ok) return;

    try {
      const res = await fetch(`/api/stock/items/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");

      toast.success("Barang berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const formatKind = (k: string) => {
    switch (k) {
      case "raw_material": return "Bahan Baku";
      case "semi_finished": return "Setengah Jadi";
      case "finished_good": return "Barang Jadi / Siap Jual";
      case "service": return "Jasa / Layanan";
      default: return k;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAdd} className={`${btnPrimarySm} gap-1.5`}>
          <Plus size={14} /> Tambah Barang
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="Master Barang"
        columns={[
          { key: "sku", label: "SKU", render: (r) => <span className="font-semibold text-gray-900">{r.sku}</span> },
          { key: "name", label: "Nama Barang" },
          { key: "category_name", label: "Kategori" },
          { key: "uom_code", label: "Satuan UOM", render: (r) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold">{r.uom_code}</span> },
          {
            key: "item_kind",
            label: "Tipe Barang",
            render: (r) => (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                r.item_kind === "raw_material"
                  ? "bg-amber-50 text-amber-800"
                  : r.item_kind === "semi_finished"
                  ? "bg-blue-50 text-blue-800"
                  : "bg-emerald-50 text-emerald-800"
              }`}>
                {formatKind(r.item_kind)}
              </span>
            ),
          },
          {
            key: "is_stocked",
            label: "Lacak Stok",
            render: (r) => (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.is_stocked ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                {r.is_stocked ? "Aktif" : "Non-Stok"}
              </span>
            ),
          },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100"
                  title="Edit Barang"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  title="Hapus Barang"
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
          title={editingId ? "Edit Barang & Bahan" : "Tambah Barang & Bahan"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">SKU / Kode Barang</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Misal: AYAM_UTUH, BUMBU"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Barang</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Ayam Potong Utuh, Bumbu Racik"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Kategori</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Satuan UOM</label>
                <select
                  value={uomId}
                  onChange={(e) => setUomId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  required
                >
                  {uoms.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipe / Klasifikasi</label>
              <select
                value={itemKind}
                onChange={(e) => setItemKind(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                <option value="raw_material">Bahan Baku (Mentah)</option>
                <option value="semi_finished">Barang Setengah Jadi (Olahan Dapur)</option>
                <option value="finished_good">Barang Jadi / Siap Jual</option>
                <option value="service">Jasa / Biaya Tambahan</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_stocked"
                checked={isStocked}
                onChange={(e) => setIsStocked(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <label htmlFor="is_stocked" className="text-xs font-medium text-gray-700">
                Lacak kuantitas dan nilai persediaan fisik di gudang / freezer
              </label>
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
