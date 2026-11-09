"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnPrimarySm, btnPrimary, btnSecondary } from "@/components/ui/button";

export type BinRow = {
  id: string;
  code: string;
  name: string;
  bin_kind: string;
  is_receiving: boolean;
  balance_count: number;
};

export function BinsManager({ rows }: { rows: BinRow[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [binKind, setBinKind] = useState("storage");
  const [isReceiving, setIsReceiving] = useState(false);
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setBinKind("storage");
    setIsReceiving(false);
    setModalOpen(true);
  };

  const openEdit = (row: BinRow) => {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setBinKind(row.bin_kind);
    setIsReceiving(Boolean(row.is_receiving));
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Kode dan nama bin lokasi wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const url = editingId ? `/api/stock/bins/${editingId}` : "/api/stock/bins";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          bin_kind: binKind,
          is_receiving: isReceiving,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan data");

      toast.success(editingId ? "Bin lokasi berhasil diperbarui" : "Bin lokasi berhasil ditambahkan");
      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: BinRow) => {
    if (row.balance_count > 0) {
      toast.error(`Bin ${row.name} masih memiliki persediaan aktif`);
      return;
    }
    const ok = await confirmAction(`Hapus bin lokasi "${row.name}" (${row.code})?`, "Hapus");
    if (!ok) return;

    try {
      const res = await fetch(`/api/stock/bins/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");

      toast.success("Bin lokasi berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAdd} className={`${btnPrimarySm} gap-1.5`}>
          <Plus size={14} /> Tambah Bin Lokasi
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="Bin Lokasi Gudang"
        columns={[
          { key: "code", label: "Kode", render: (r) => <span className="font-semibold text-gray-900">{r.code}</span> },
          { key: "name", label: "Nama Bin Lokasi" },
          {
            key: "bin_kind",
            label: "Jenis Bin",
            render: (r) => (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 capitalize">
                {r.bin_kind}
              </span>
            ),
          },
          {
            key: "is_receiving",
            label: "Penerimaan Barang",
            render: (r) => (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.is_receiving ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-400"}`}>
                {r.is_receiving ? "Default GRN" : "Penyimpanan"}
              </span>
            ),
          },
          { key: "balance_count", label: "Jml Item Disimpan", numeric: true },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100"
                  title="Edit Bin"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  title="Hapus Bin"
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
          title={editingId ? "Edit Bin Lokasi" : "Tambah Bin Lokasi"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kode Bin</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Misal: BIN_GUDANG, BIN_FREEZER"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Bin Lokasi</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Gudang Bahan Pusat, Freezer Dapur"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jenis Bin</label>
              <select
                value={binKind}
                onChange={(e) => setBinKind(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                <option value="storage">Storage (Penyimpanan Standar)</option>
                <option value="freezer">Freezer (Pendingin)</option>
                <option value="receiving">Receiving (Penerimaan)</option>
                <option value="transit">Transit</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_receiving"
                checked={isReceiving}
                onChange={(e) => setIsReceiving(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <label htmlFor="is_receiving" className="text-xs font-medium text-gray-700">
                Gunakan sebagai bin penerimaan barang masuk default (GRN)
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

