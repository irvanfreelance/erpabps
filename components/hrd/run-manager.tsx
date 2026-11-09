"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit2, Eye, Plus, Trash2, CheckCircle, Calculator } from "lucide-react";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export type RunItem = {
  id: string;
  employee_id: string;
  full_name: string;
  payable_minutes: number;
  late_minutes: number;
  earnings_total: string | number;
  deduction_total: string | number;
  net_pay: string | number;
};

export type ItemDetail = {
  id: string;
  component_code: string;
  quantity: number;
  unit_rate: number;
  amount: number;
  source_ref: string | null;
};

export function RunManager({
  runId,
  status,
  items,
  isSuperadmin,
}: {
  runId: string;
  status: string;
  items: RunItem[];
  isSuperadmin: boolean;
}) {
  const router = useRouter();
  const frozen = status === "approved" || status === "paid";
  const [loading, setLoading] = useState(false);

  // State untuk modal edit item / override
  const [selectedItem, setSelectedItem] = useState<RunItem | null>(null);
  const [details, setDetails] = useState<ItemDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form override komponen baru
  const [compCode, setCompCode] = useState("BONUS_MANUAL");
  const [compAmount, setCompAmount] = useState("");
  const [compQty, setCompQty] = useState("1");

  async function act(action: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/payroll-runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(typeof json.error === "string" ? json.error : "Gagal memproses aksi");
      }
      toast.success(action === "approve" ? "Payroll berhasil disetujui dan dibekukan" : "Payroll berhasil dikalkulasi ulang");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function openDetailModal(item: RunItem) {
    setSelectedItem(item);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/payroll-items/${item.id}`);
      if (!res.ok) throw new Error("Gagal mengambil detail komponen");
      const data = await res.json();
      setDetails(data.details || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat detail");
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleUpsertDetail() {
    if (!selectedItem) return;
    const amountNum = Number(compAmount);
    if (!compCode || isNaN(amountNum)) {
      toast.error("Kode dan nominal komponen wajib diisi dengan benar");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/payroll-items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_detail",
          componentCode: compCode,
          amount: amountNum,
          quantity: Number(compQty) || 1,
          unitRate: amountNum,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan override komponen");
      }
      toast.success(`Komponen ${compCode} berhasil di-override`);
      setCompAmount("");
      // Refresh detail modal
      await openDetailModal(selectedItem);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan saat override");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDetail(detailId: string) {
    if (!selectedItem) return;
    if (!confirm("Hapus komponen ini?")) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/payroll-items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_detail",
          detailId,
        }),
      });
      if (!res.ok) throw new Error("Gagal menghapus komponen");
      toast.success("Komponen berhasil dihapus");
      await openDetailModal(selectedItem);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  const formatRupiah = (val: string | number) =>
    `Rp ${Number(val).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      {isSuperadmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white p-3">
          <div className="text-[13px] text-gray-600">
            Status: <span className="font-semibold uppercase text-[var(--primary)]">{status}</span>
            {frozen && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Terkunci (Approved)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={frozen || loading}
              onClick={() => act("calculate")}
            >
              <Calculator className="mr-1.5 h-4 w-4" />
              Hitung Ulang
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={frozen || loading}
              onClick={() => {
                if (confirm("Setujui dan kunci payroll run ini? Data tidak dapat dihitung ulang setelah disetujui.")) {
                  act("approve");
                }
              }}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Setujui & Finalisasi
            </button>
          </div>
        </div>
      )}

      {/* Item List Table */}
      <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b bg-[var(--primary)] text-[12px] font-semibold text-white">
            <tr>
              <th className="px-3 py-2.5">Karyawan</th>
              <th className="px-3 py-2.5 text-right">Menit Hadir</th>
              <th className="px-3 py-2.5 text-right">Menit Telat</th>
              <th className="px-3 py-2.5 text-right">Penghasilan</th>
              <th className="px-3 py-2.5 text-right">Potongan</th>
              <th className="px-3 py-2.5 text-right font-bold text-white">Gaji Netto</th>
              <th className="px-3 py-2.5 text-center">Pemeriksaan / Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  Belum ada karyawan yang dikalkulasi pada run ini. Klik tombol <strong>Hitung Ulang</strong> untuk memulai kalkulasi.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{item.full_name}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {item.payable_minutes} mnt ({Math.round(item.payable_minutes / 60)} jam)
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {item.late_minutes > 0 ? (
                      <span className="font-semibold text-rose-600">{item.late_minutes} mnt</span>
                    ) : (
                      <span className="text-gray-400">0 mnt</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-emerald-600 font-medium">
                    {formatRupiah(item.earnings_total)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-rose-600 font-medium">
                    {formatRupiah(item.deduction_total)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-[var(--primary)]">
                    {formatRupiah(item.net_pay)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => openDetailModal(item)}
                      className="inline-flex items-center gap-1 rounded bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
                    >
                      {isSuperadmin && !frozen ? (
                        <>
                          <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                          Periksa & Override
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Lihat Komponen
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Pemeriksaan / Override Komponen Karyawan */}
      {selectedItem && (
        <Modal
          title={`Periksa Rincian Gaji — ${selectedItem.full_name}`}
          onClose={() => setSelectedItem(null)}
        >
          <div className="space-y-4 text-[13px]">
            {loadingDetails ? (
              <div className="py-6 text-center text-gray-500">Memuat rincian komponen...</div>
            ) : (
              <>
                <div className="rounded border bg-gray-50 p-2.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Hadir:</span>
                    <strong className="text-gray-800">{selectedItem.payable_minutes} menit</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Telat:</span>
                    <strong className="text-gray-800">{selectedItem.late_minutes} menit</strong>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-gray-500">
                    Rincian Komponen Terkalkulasi
                  </h4>
                  <table className="w-full text-left text-[12px]">
                    <thead className="border-b bg-gray-100 text-gray-600">
                      <tr>
                        <th className="p-1.5">Komponen</th>
                        <th className="p-1.5">Ref / Sumber</th>
                        <th className="p-1.5 text-right">Nominal</th>
                        {isSuperadmin && !frozen && <th className="p-1.5 text-center">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {details.map((d) => (
                        <tr key={d.id}>
                          <td className="p-1.5 font-medium text-gray-800">
                            {d.component_code}
                            {d.quantity > 1 && (
                              <span className="ml-1 text-[11px] text-gray-400">
                                ({d.quantity} x @{formatRupiah(d.unit_rate)})
                              </span>
                            )}
                          </td>
                          <td className="p-1.5 text-[11px] text-gray-500">
                            {d.source_ref === "manual_override" ? (
                              <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-800 font-semibold">
                                Override HR
                              </span>
                            ) : (
                              d.source_ref || "kalkulasi"
                            )}
                          </td>
                          <td
                            className={`p-1.5 text-right font-medium ${
                              Number(d.amount) >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {formatRupiah(d.amount)}
                          </td>
                          {isSuperadmin && !frozen && (
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteDetail(d.id)}
                                className="text-rose-600 hover:text-rose-800"
                                title="Hapus Komponen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Form Override / Tambah Komponen Manual (Khusus HR Superadmin sebelum approved) */}
                {isSuperadmin && !frozen && (
                  <div className="rounded border border-amber-200 bg-amber-50/50 p-3">
                    <h5 className="mb-2 text-[12px] font-bold text-amber-900">
                      Tambah / Override Komponen Manual (Superadmin)
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-700">Kode Komponen</label>
                        <select
                          value={compCode}
                          onChange={(e) => setCompCode(e.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 p-1.5 text-[12px]"
                        >
                          <option value="BONUS_MANUAL">BONUS_MANUAL (Penghasilan +)</option>
                          <option value="INSENTIF_TGL_MERAH">INSENTIF_TGL_MERAH (Penghasilan +)</option>
                          <option value="TUNJANGAN_KHUSUS">TUNJANGAN_KHUSUS (Penghasilan +)</option>
                          <option value="KASBON">KASBON (Potongan -)</option>
                          <option value="POTONGAN_LAIN">POTONGAN_LAIN (Potongan -)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-700">Nominal (+ atau -)</label>
                        <input
                          type="number"
                          value={compAmount}
                          onChange={(e) => setCompAmount(e.target.value)}
                          placeholder="Cth: 50000 atau -25000"
                          className="mt-1 w-full rounded border border-gray-300 p-1.5 text-[12px]"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleUpsertDetail}
                          disabled={loading || !compAmount}
                          className="inline-flex w-full items-center justify-center gap-1 rounded bg-amber-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Terapkan
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-amber-700">
                      Gunakan nilai positif untuk penambahan (bonus/insentif) dan nilai negatif untuk potongan kasbon/denda.
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setSelectedItem(null)}
                  >
                    Tutup
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
