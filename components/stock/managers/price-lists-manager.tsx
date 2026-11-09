"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate } from "@/lib/utils/format";
import { btnPrimarySm, btnPrimary, btnSecondary } from "@/components/ui/button";

export type PriceListRow = {
  id: string;
  code: string;
  party_kind: string;
  margin_percent: number | string;
  effective_from: string;
  effective_to: string | null;
};

export function PriceListsManager({ rows }: { rows: PriceListRow[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [partyKind, setPartyKind] = useState("internal_outlet");
  const [marginPercent, setMarginPercent] = useState("20");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setCode("");
    setPartyKind("internal_outlet");
    setMarginPercent("20");
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setEffectiveTo("");
    setModalOpen(true);
  };

  const openEdit = (row: PriceListRow) => {
    setEditingId(row.id);
    setCode(row.code);
    setPartyKind(row.party_kind);
    setMarginPercent(String(row.margin_percent));
    setEffectiveFrom(row.effective_from);
    setEffectiveTo(row.effective_to || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !effectiveFrom) {
      toast.error("Kode daftar harga dan tanggal mulai wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const url = editingId ? `/api/stock/price-lists/${editingId}` : "/api/stock/price-lists";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          party_kind: partyKind,
          margin_percent: Number(marginPercent),
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan data");

      toast.success(editingId ? "Daftar harga berhasil diperbarui" : "Daftar harga berhasil ditambahkan");
      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: PriceListRow) => {
    const ok = await confirmAction(`Hapus aturan harga "${row.code}"?`, "Hapus");
    if (!ok) return;

    try {
      const res = await fetch(`/api/stock/price-lists/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");

      toast.success("Daftar harga berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  const formatKind = (k: string) => {
    switch (k) {
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
          <Plus size={14} /> Tambah Daftar Harga Margin
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="Daftar Harga dan Margin"
        columns={[
          { key: "code", label: "Kode Skema", render: (r) => <span className="font-semibold text-gray-900">{r.code}</span> },
          {
            key: "party_kind",
            label: "Kanal / Target Mitra",
            render: (r) => (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                r.party_kind === "internal_outlet"
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
            key: "margin_percent",
            label: "Margin Target (%)",
            numeric: true,
            render: (r) => (
              <span className="font-bold text-emerald-700">
                +{Number(r.margin_percent).toFixed(0)}%
              </span>
            ),
          },
          { key: "effective_from", label: "Berlaku Mulai", render: (r) => fmtDate(r.effective_from) },
          { key: "effective_to", label: "Berlaku Sampai", render: (r) => r.effective_to ? fmtDate(r.effective_to) : "Seterusnya" },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100"
                  title="Edit Margin"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  title="Hapus Margin"
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
          title={editingId ? "Edit Daftar Harga Margin" : "Tambah Daftar Harga Margin"}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kode Skema Harga</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Misal: PL_OUTLET_INT, PL_CATERING"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kanal Target</label>
              <select
                value={partyKind}
                onChange={(e) => setPartyKind(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                <option value="internal_outlet">Outlet Cabang Sendiri (Internal - default 20%)</option>
                <option value="third_party_outlet">Outlet Mitra Pihak Ke-3 (Customer)</option>
                <option value="catering">Kanal Penjualan Catering / Pesanan (default 30%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Margin Persen (%) di Atas HPP</label>
              <input
                type="number"
                step="0.1"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                placeholder="20"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Berlaku Mulai</label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Berlaku Sampai (Opsional)</label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                />
              </div>
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
