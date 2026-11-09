"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnPrimarySm, btnPrimary, btnSecondary } from "@/components/ui/button";

export type PartyRow = {
  id: string;
  code: string;
  name: string;
  party_kind: string;
};

export function PartiesManager({ rows }: { rows: PartyRow[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [partyKind, setPartyKind] = useState("vendor");
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setPartyKind("vendor");
    setModalOpen(true);
  };

  const openEdit = (row: PartyRow) => {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setPartyKind(row.party_kind);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Kode dan nama rekanan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const url = editingId ? `/api/stock/parties/${editingId}` : "/api/stock/parties";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          party_kind: partyKind,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan data");

      toast.success(editingId ? "Rekanan berhasil diperbarui" : "Rekanan berhasil ditambahkan");
      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: PartyRow) => {
    const ok = await confirmAction(`Hapus rekanan/mitra "${row.name}" (${row.code})?`, "Hapus");
    if (!ok) return;

    try {
      const res = await fetch(`/api/stock/parties/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");

      toast.success("Rekanan berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const formatKind = (k: string) => {
    switch (k) {
      case "vendor": return "Vendor / Pemasok";
      case "internal_outlet": return "Outlet Internal";
      case "third_party_outlet": return "Outlet Mitra Pihak Ke-3";
      case "catering": return "Kanal Catering";
      default: return k;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAdd} className={`${btnPrimarySm} gap-1.5`}>
          <Plus size={14} /> Tambah Rekanan / Mitra
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="Rekanan dan Mitra"
        columns={[
          { key: "code", label: "Kode", render: (r) => <span className="font-semibold text-gray-900">{r.code}</span> },
          { key: "name", label: "Nama Rekanan / Mitra" },
          {
            key: "party_kind",
            label: "Jenis Rekanan",
            render: (r) => (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                r.party_kind === "vendor"
                  ? "bg-amber-50 text-amber-800"
                  : r.party_kind === "internal_outlet"
                  ? "bg-blue-50 text-blue-800"
                  : r.party_kind === "catering"
                  ? "bg-purple-50 text-purple-800"
                  : "bg-emerald-50 text-emerald-800"
              }`}>
                {formatKind(r.party_kind)}
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
                  title="Edit Rekanan"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  title="Hapus Rekanan"
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
          title={editingId ? "Edit Rekanan / Mitra" : "Tambah Rekanan / Mitra"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kode Rekanan</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Misal: VEND_AYAM, OUT_BAROS, MITRA_01, CAT_01"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Rekanan / Mitra</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: PT Berkah Unggas, Outlet Baros Internal"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Jenis Rekanan / Kanal</label>
              <select
                value={partyKind}
                onChange={(e) => setPartyKind(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                <option value="vendor">Vendor / Pemasok Bahan</option>
                <option value="internal_outlet">Outlet Cabang Sendiri (Internal)</option>
                <option value="third_party_outlet">Outlet Mitra Pihak Ke-3 (Customer)</option>
                <option value="catering">Kanal Penjualan Catering / Pesanan</option>
              </select>
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

