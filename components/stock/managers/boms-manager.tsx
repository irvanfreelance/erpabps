"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Eye } from "lucide-react";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { fmtDate, fmtQty } from "@/lib/utils/format";
import { btnPrimarySm, btnPrimary, btnSecondary } from "@/components/ui/button";

export type BomRow = {
  id: string;
  output_qty: number | string;
  output_item_name: string;
  effective_from: string;
  lines: Array<{
    id: number;
    item_id: number;
    item_name: string;
    sku: string;
    qty: number;
  }>;
};

export type ItemOpt = { id: string; name: string; sku: string };

export function BomsManager({
  rows,
  outputItems,
  ingredientItems,
}: {
  rows: BomRow[];
  outputItems: ItemOpt[];
  ingredientItems: ItemOpt[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<BomRow | null>(null);

  const [outputItemId, setOutputItemId] = useState(outputItems[0]?.id || "");
  const [outputQty, setOutputQty] = useState("10");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<Array<{ item_id: string; qty: string }>>([
    { item_id: ingredientItems[0]?.id || "", qty: "1" },
  ]);
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setOutputItemId(outputItems[0]?.id || "");
    setOutputQty("10");
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setLines([{ item_id: ingredientItems[0]?.id || "", qty: "1" }]);
    setModalOpen(true);
  };

  const addLine = () => {
    setLines([...lines, { item_id: ingredientItems[0]?.id || "", qty: "1" }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: "item_id" | "qty", val: string) => {
    const updated = [...lines];
    updated[index][field] = val;
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outputItemId || !outputQty || !effectiveFrom || lines.length === 0) {
      toast.error("Semua field wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stock/boms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output_item_id: outputItemId,
          output_qty: Number(outputQty),
          effective_from: effectiveFrom,
          lines: lines.map((l) => ({ item_id: Number(l.item_id), qty: Number(l.qty) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan resep");

      toast.success("Resep BOM berhasil disimpan");
      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: BomRow) => {
    const ok = await confirmAction(`Hapus resep BOM untuk "${row.output_item_name}"?`, "Hapus");
    if (!ok) return;

    try {
      const res = await fetch(`/api/stock/boms/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");

      toast.success("Resep BOM berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAdd} className={`${btnPrimarySm} gap-1.5`}>
          <Plus size={14} /> Tambah Resep BOM
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="Resep BOM Olahan"
        columns={[
          {
            key: "output_item_name",
            label: "Barang Hasil Olahan",
            render: (r) => <span className="font-semibold text-gray-900">{r.output_item_name}</span>,
          },
          {
            key: "output_qty",
            label: "Batch Standar",
            numeric: true,
            render: (r) => <span className="font-medium text-emerald-800">{fmtQty(r.output_qty)} kg</span>,
          },
          {
            key: "lines",
            label: "Komposisi Bahan",
            render: (r) => (
              <span className="text-xs text-gray-600">
                {(r.lines || []).map((l) => `${l.item_name} (${l.qty})`).join(", ")}
              </span>
            ),
          },
          { key: "effective_from", label: "Berlaku Mulai", render: (r) => fmtDate(r.effective_from) },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewRow(r)}
                  className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                  title="Lihat Detail Resep"
                >
                  <Eye size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  title="Hapus Resep"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Modal Detail */}
      {viewRow && (
        <Modal
          title={`Detail Resep BOM: ${viewRow.output_item_name}`}
          onClose={() => setViewRow(null)}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Output Target:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">
                  {fmtQty(viewRow.output_qty)} kg {viewRow.output_item_name}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Tanggal Efektif:</span>
                <div className="font-semibold text-gray-800 mt-0.5">{fmtDate(viewRow.effective_from)}</div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-800 mb-2">Bahan Baku yang Digunakan:</div>
              <table className="w-full text-left border rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-1.5 px-3">Bahan</th>
                    <th className="py-1.5 px-3">SKU</th>
                    <th className="py-1.5 px-3 text-right">Kebutuhan Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewRow.lines || []).map((l, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium">{l.item_name}</td>
                      <td className="py-2 px-3 text-gray-500">{l.sku}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-800">{fmtQty(l.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setViewRow(null)} className={btnSecondary}>
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Tambah */}
      {modalOpen && (
        <Modal
          title="Tambah Resep BOM (Formula Produksi)"
          onClose={() => setModalOpen(false)}
          maxWidth="sm:max-w-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Barang Hasil Olahan</label>
                <select
                  value={outputItemId}
                  onChange={(e) => setOutputItemId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  required
                >
                  {outputItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Output Kuantitas</label>
                <input
                  type="number"
                  step="0.01"
                  value={outputQty}
                  onChange={(e) => setOutputQty(e.target.value)}
                  placeholder="10"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Mulai Berlaku</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">Daftar Bahan Baku Komposisi</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs text-[var(--primary)] font-semibold hover:underline"
                >
                  + Tambah Baris Bahan
                </button>
              </div>

              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={line.item_id}
                      onChange={(e) => updateLine(idx, "item_id", e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]"
                    >
                      {ingredientItems.map((ing) => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.sku})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, "qty", e.target.value)}
                      placeholder="Qty"
                      className="w-24 rounded-xl border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]"
                      required
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
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
                {loading ? "Menyimpan..." : "Simpan Resep"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
