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

export type SalesOrderRow = {
  id: string;
  doc_no: string;
  party_name: string;
  status: string;
  ordered_on: string;
  creator_name: string;
  lines?: Array<{
    id: number;
    item_name: string;
    sku: string;
    qty: number;
  }>;
};

export type PartyOpt = { id: string; name: string };
export type ItemOpt = { id: string; name: string; sku: string };

export function SalesOrdersManager({
  rows,
  parties,
  availableItems,
}: {
  rows: SalesOrderRow[];
  parties: PartyOpt[];
  availableItems: ItemOpt[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState<SalesOrderRow | null>(null);

  const [docNo, setDocNo] = useState("");
  const [partyId, setPartyId] = useState(parties[0]?.id || "");
  const [orderedOn, setOrderedOn] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<Array<{ item_id: string; qty: string }>>([
    { item_id: availableItems[0]?.id || "", qty: "1" },
  ]);
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setDocNo(`SO-${Date.now().toString().slice(-4)}`);
    setPartyId(parties[0]?.id || "");
    setOrderedOn(new Date().toISOString().split("T")[0]);
    setLines([{ item_id: availableItems[0]?.id || "", qty: "1" }]);
    setModalOpen(true);
  };

  const addLine = () => {
    setLines([...lines, { item_id: availableItems[0]?.id || "", qty: "1" }]);
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
    if (!docNo.trim() || !partyId || !orderedOn || lines.length === 0) {
      toast.error("Nomor order, pelanggan/kanal, tanggal, dan minimal 1 item penjualan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stock/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_no: docNo.trim(),
          party_id: partyId,
          ordered_on: orderedOn,
          lines: lines.map((l) => ({ item_id: Number(l.item_id), qty: Number(l.qty) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat sales order");

      toast.success("Order penjualan berhasil dibuat");
      setModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: SalesOrderRow) => {
    const ok = await confirmAction(`Hapus order penjualan "${row.doc_no}"?`, "Hapus");
    if (!ok) return;

    try {
      const res = await fetch(`/api/stock/sales-orders/${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");

      toast.success("Order penjualan berhasil dihapus");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAdd} className={`${btnPrimarySm} gap-1.5`}>
          <Plus size={14} /> Buat Order Penjualan (SO)
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="Order Penjualan"
        columns={[
          { key: "doc_no", label: "No. SO", render: (r) => <span className="font-semibold text-gray-900">{r.doc_no}</span> },
          { key: "party_name", label: "Pemesan / Kanal", render: (r) => <span className="font-medium text-blue-800">{r.party_name}</span> },
          { key: "status", label: "Status", render: (r) => <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 uppercase">{r.status}</span> },
          { key: "ordered_on", label: "Tanggal Pesan", render: (r) => fmtDate(r.ordered_on) },
          { key: "creator_name", label: "Sales Staff" },
          {
            key: "actions",
            label: "Aksi",
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewRow(r)}
                  className="rounded-lg border border-gray-200 p-1.5 text-blue-600 hover:bg-blue-50"
                  title="Lihat Detail Item"
                >
                  <Eye size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  title="Hapus SO"
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
          title={`Detail Order Penjualan: ${viewRow.doc_no}`}
          onClose={() => setViewRow(null)}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div>
                <span className="text-gray-500">Pelanggan / Kanal:</span>
                <div className="font-bold text-gray-900 text-sm mt-0.5">{viewRow.party_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Tanggal Order:</span>
                <div className="font-semibold text-gray-800 mt-0.5">{fmtDate(viewRow.ordered_on)}</div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-gray-800 mb-2">Item Produk yang Dipesan:</div>
              <table className="w-full text-left border rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-1.5 px-3">Nama Produk</th>
                    <th className="py-1.5 px-3">SKU</th>
                    <th className="py-1.5 px-3 text-right">Kuantitas</th>
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
          title="Buat Order Penjualan Baru (SO)"
          onClose={() => setModalOpen(false)}
          maxWidth="sm:max-w-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor Order SO</label>
                <input
                  type="text"
                  value={docNo}
                  onChange={(e) => setDocNo(e.target.value)}
                  placeholder="SO-..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pelanggan / Kanal Penjualan</label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                  required
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Pemesanan</label>
              <input
                type="date"
                value={orderedOn}
                onChange={(e) => setOrderedOn(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">Daftar Produk yang Dijual</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs text-[var(--primary)] font-semibold hover:underline"
                >
                  + Tambah Baris Produk
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
                      {availableItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
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
                {loading ? "Menyimpan..." : "Simpan Order"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
