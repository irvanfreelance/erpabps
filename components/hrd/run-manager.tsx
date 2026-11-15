"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit2, Eye, Plus, Trash2, CheckCircle, Calculator, Pencil, Check, X } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { componentQtyLabel } from "@/lib/hrd/component-qty";
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
  const [addCode, setAddCode] = useState("BONUS_MANUAL");
  const [addAmount, setAddAmount] = useState("");
  const [dedCode, setDedCode] = useState("KASBON");
  const [dedAmount, setDedAmount] = useState("");
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  function formatThousands(val: string) {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("id-ID");
  }

  function parseDigits(val: string) {
    const digits = val.replace(/\D/g, "");
    return digits ? Number(digits) : 0;
  }
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

  async function handleUpsertManual(code: string, rawAmount: string, isDeduction: boolean) {
    if (!selectedItem || !rawAmount) return;
    const parsed = parseDigits(rawAmount);
    if (!code || parsed === 0) {
      toast.error("Nominal harus lebih dari 0");
      return;
    }
    const amountNum = isDeduction ? -parsed : parsed;

    try {
      setLoading(true);
      const res = await fetch(`/api/payroll-items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_detail",
          componentCode: code,
          amount: amountNum,
          quantity: 1,
          unitRate: amountNum,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan override komponen");
      }
      toast.success(`Komponen ${code} berhasil diterapkan`);
      if (isDeduction) setDedAmount("");
      else setAddAmount("");
      await openDetailModal(selectedItem);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan saat override");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit(d: ItemDetail, isDeduction: boolean) {
    if (!selectedItem || editAmount === "") return;
    const mag = parseDigits(editAmount);
    const parsed = isDeduction ? -mag : mag;
    try {
      setLoading(true);
      const res = await fetch(`/api/payroll-items/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_detail",
          componentCode: d.component_code,
          amount: parsed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan perubahan");
      toast.success(`Komponen ${d.component_code} diperbarui`);
      setEditingDetailId(null);
      setEditAmount("");
      await openDetailModal(selectedItem);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
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

  const itemColumns: Column<RunItem>[] = [
    {
      key: "full_name",
      label: "Karyawan",
      render: (item) => <span className="font-medium text-gray-900">{item.full_name}</span>,
    },
    {
      key: "payable_minutes",
      label: "Menit Hadir",
      numeric: true,
      render: (item) => (
        <span className="text-gray-600">
          {item.payable_minutes} mnt ({Math.round(item.payable_minutes / 60)} jam)
        </span>
      ),
      exportValue: (item) => item.payable_minutes,
    },
    {
      key: "late_minutes",
      label: "Menit Telat",
      numeric: true,
      render: (item) =>
        item.late_minutes > 0 ? (
          <span className="font-semibold text-rose-600">{item.late_minutes} mnt</span>
        ) : (
          <span className="text-gray-400">0 mnt</span>
        ),
      exportValue: (item) => item.late_minutes,
    },
    {
      key: "earnings_total",
      label: "Penghasilan",
      money: true,
      render: (item) => (
        <span className="font-medium text-emerald-600">{formatRupiah(item.earnings_total)}</span>
      ),
      exportValue: (item) => Number(item.earnings_total),
    },
    {
      key: "deduction_total",
      label: "Potongan",
      money: true,
      render: (item) => (
        <span className="font-medium text-rose-600">{formatRupiah(item.deduction_total)}</span>
      ),
      exportValue: (item) => Number(item.deduction_total),
    },
    {
      key: "net_pay",
      label: "Gaji Netto",
      money: true,
      render: (item) => (
        <span className="font-bold text-[var(--primary)]">{formatRupiah(item.net_pay)}</span>
      ),
      exportValue: (item) => Number(item.net_pay),
    },
    {
      key: "actions",
      label: "Pemeriksaan / Override",
      includeInExport: false,
      sticky: "right",
      render: (item) => (
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
      ),
    },
  ];

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
      <DataTable
        columns={itemColumns}
        data={items}
        exportFilename={`Payroll_Run_${runId}_${new Date().toISOString().slice(0, 10)}`}
      />

      {/* Modal Pemeriksaan / Override Komponen Karyawan */}
      {selectedItem && (
        <Modal
          title={`Periksa Rincian Gaji — ${selectedItem.full_name}`}
          onClose={() => setSelectedItem(null)}
          maxWidth="sm:max-w-4xl"
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

                {(() => {
                  const earnings = details.filter((d) => Number(d.amount) >= 0);
                  const deductions = details.filter((d) => Number(d.amount) < 0);
                  const totalEarnings = earnings.reduce((acc, d) => acc + Number(d.amount), 0);
                  const totalDeductions = deductions.reduce((acc, d) => acc + Math.abs(Number(d.amount)), 0);
                  const takeHomePay = totalEarnings - totalDeductions;

                  const renderTable = (
                    list: ItemDetail[],
                    emptyText: string,
                    isDeduction: boolean,
                  ) => (
                    <table className="w-full text-left text-[12px]">
                      <thead className="border-b bg-gray-100 text-gray-600">
                        <tr>
                          <th className="p-1.5">Komponen</th>
                          <th className="p-1.5 text-right">Nominal</th>
                          {isSuperadmin && !frozen && <th className="p-1.5 text-center w-16">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {list.length === 0 ? (
                          <tr>
                            <td colSpan={isSuperadmin && !frozen ? 3 : 2} className="p-3 text-center text-[11px] text-gray-400">
                              {emptyText}
                            </td>
                          </tr>
                        ) : (
                          list.map((d) => {
                            const isEditing = editingDetailId === d.id;
                            const itemColumns: Column<RunItem>[] = [
    {
      key: "full_name",
      label: "Karyawan",
      render: (item) => <span className="font-medium text-gray-900">{item.full_name}</span>,
    },
    {
      key: "payable_minutes",
      label: "Menit Hadir",
      numeric: true,
      render: (item) => (
        <span className="text-gray-600">
          {item.payable_minutes} mnt ({Math.round(item.payable_minutes / 60)} jam)
        </span>
      ),
      exportValue: (item) => item.payable_minutes,
    },
    {
      key: "late_minutes",
      label: "Menit Telat",
      numeric: true,
      render: (item) =>
        item.late_minutes > 0 ? (
          <span className="font-semibold text-rose-600">{item.late_minutes} mnt</span>
        ) : (
          <span className="text-gray-400">0 mnt</span>
        ),
      exportValue: (item) => item.late_minutes,
    },
    {
      key: "earnings_total",
      label: "Penghasilan",
      money: true,
      render: (item) => (
        <span className="font-medium text-emerald-600">{formatRupiah(item.earnings_total)}</span>
      ),
      exportValue: (item) => Number(item.earnings_total),
    },
    {
      key: "deduction_total",
      label: "Potongan",
      money: true,
      render: (item) => (
        <span className="font-medium text-rose-600">{formatRupiah(item.deduction_total)}</span>
      ),
      exportValue: (item) => Number(item.deduction_total),
    },
    {
      key: "net_pay",
      label: "Gaji Netto",
      money: true,
      render: (item) => (
        <span className="font-bold text-[var(--primary)]">{formatRupiah(item.net_pay)}</span>
      ),
      exportValue: (item) => Number(item.net_pay),
    },
    {
      key: "actions",
      label: "Pemeriksaan / Override",
      includeInExport: false,
      sticky: "right",
      render: (item) => (
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
      ),
    },
  ];

  return (
                              <tr key={d.id} className="hover:bg-gray-50/70">
                                <td className="p-1.5 font-medium text-gray-800">
                                  <div>{d.component_code}</div>
                                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                    {d.source_ref === "manual_override" ? (
                                      <span className="rounded bg-amber-100 px-1 py-0.2 font-semibold text-amber-800">
                                        Override HR
                                      </span>
                                    ) : (
                                      <span>{d.source_ref || "kalkulasi"}</span>
                                    )}
                                    {d.quantity > 1 && (
                                      <span>({d.quantity} x @{formatRupiah(d.unit_rate)})</span>
                                    )}
                                  </div>
                                </td>
                                <td
                                  className={`p-1.5 text-right font-medium ${
                                    isDeduction ? "text-rose-600" : "text-emerald-600"
                                  }`}
                                >
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={editAmount}
                                        onChange={(e) => setEditAmount(formatThousands(e.target.value))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleSaveEdit(d, isDeduction);
                                          if (e.key === "Escape") {
                                            setEditingDetailId(null);
                                            setEditAmount("");
                                          }
                                        }}
                                        className="w-28 rounded border border-amber-400 bg-white px-2 py-0.5 text-right text-[12px] text-gray-900 tabular-nums focus:outline-none"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleSaveEdit(d, isDeduction)}
                                        className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-700"
                                        title="Simpan"
                                      >
                                        <Check className="h-3 w-3" />
                                        Simpan
                                      </button>
                                      <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => {
                                          setEditingDetailId(null);
                                          setEditAmount("");
                                        }}
                                        className="inline-flex items-center rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100"
                                        title="Batal"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="whitespace-nowrap">{formatRupiah(d.amount)}</span>
                                  )}
                                </td>
                                {isSuperadmin && !frozen && !isEditing && (
                                  <td className="p-1.5 text-center whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingDetailId(d.id);
                                          setEditAmount(formatThousands(String(Math.abs(Number(d.amount)))));
                                        }}
                                        className="text-amber-600 hover:text-amber-800"
                                        title="Edit Nominal"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDetail(d.id)}
                                        className="text-rose-600 hover:text-rose-800"
                                        title="Hapus Komponen"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  );

                  const itemColumns: Column<RunItem>[] = [
    {
      key: "full_name",
      label: "Karyawan",
      render: (item) => <span className="font-medium text-gray-900">{item.full_name}</span>,
    },
    {
      key: "payable_minutes",
      label: "Menit Hadir",
      numeric: true,
      render: (item) => (
        <span className="text-gray-600">
          {item.payable_minutes} mnt ({Math.round(item.payable_minutes / 60)} jam)
        </span>
      ),
      exportValue: (item) => item.payable_minutes,
    },
    {
      key: "late_minutes",
      label: "Menit Telat",
      numeric: true,
      render: (item) =>
        item.late_minutes > 0 ? (
          <span className="font-semibold text-rose-600">{item.late_minutes} mnt</span>
        ) : (
          <span className="text-gray-400">0 mnt</span>
        ),
      exportValue: (item) => item.late_minutes,
    },
    {
      key: "earnings_total",
      label: "Penghasilan",
      money: true,
      render: (item) => (
        <span className="font-medium text-emerald-600">{formatRupiah(item.earnings_total)}</span>
      ),
      exportValue: (item) => Number(item.earnings_total),
    },
    {
      key: "deduction_total",
      label: "Potongan",
      money: true,
      render: (item) => (
        <span className="font-medium text-rose-600">{formatRupiah(item.deduction_total)}</span>
      ),
      exportValue: (item) => Number(item.deduction_total),
    },
    {
      key: "net_pay",
      label: "Gaji Netto",
      money: true,
      render: (item) => (
        <span className="font-bold text-[var(--primary)]">{formatRupiah(item.net_pay)}</span>
      ),
      exportValue: (item) => Number(item.net_pay),
    },
    {
      key: "actions",
      label: "Pemeriksaan / Override",
      includeInExport: false,
      sticky: "right",
      render: (item) => (
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
      ),
    },
  ];

  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Kolom Kiri: Penambah */}
                        <div className="rounded-lg border border-emerald-200 bg-white overflow-hidden">
                          <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-3 py-2">
                            <span className="text-[12px] font-bold text-emerald-800">
                              PENAMBAH (PENDAPATAN +)
                            </span>
                            <span className="text-[12px] font-bold text-emerald-700">
                              {formatRupiah(totalEarnings)}
                            </span>
                          </div>
                          {renderTable(earnings, "Belum ada komponen penambah", false)}
                        </div>

                        {/* Kolom Kanan: Pengurang */}
                        <div className="rounded-lg border border-rose-200 bg-white overflow-hidden">
                          <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-3 py-2">
                            <span className="text-[12px] font-bold text-rose-800">
                              PENGURANG (POTONGAN -)
                            </span>
                            <span className="text-[12px] font-bold text-rose-700">
                              -{formatRupiah(totalDeductions)}
                            </span>
                          </div>
                          {renderTable(deductions, "Tidak ada potongan", true)}
                        </div>
                      </div>

                      {/* Grand Total Take Home Pay */}
                      <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5">
                        <span className="text-[13px] font-bold text-emerald-900">
                          GRAND TOTAL TAKE HOME PAY
                        </span>
                        <span className="text-[16px] font-extrabold text-emerald-700 tabular-nums">
                          {formatRupiah(takeHomePay)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Form Override / Tambah Komponen Manual Terpisah (Penambah & Pengurang) */}
                {isSuperadmin && !frozen && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Tambah Penambah (+) */}
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                      <h5 className="mb-2 text-[12px] font-bold text-emerald-900">
                        + Tambah / Override Penambah
                      </h5>
                      <div className="space-y-2">
                        <select
                          value={addCode}
                          onChange={(e) => setAddCode(e.target.value)}
                          className="w-full rounded border border-emerald-300 bg-white p-1.5 text-[12px]"
                        >
                          <option value="BONUS_MANUAL">BONUS_MANUAL</option>
                          <option value="INSENTIF_TGL_MERAH">INSENTIF_TGL_MERAH</option>
                          <option value="TUNJANGAN_KHUSUS">TUNJANGAN_KHUSUS</option>
                          <option value="LEMBUR">LEMBUR</option>
                          <option value="GAPOK">GAPOK</option>
                          <option value="TUNJ_JABATAN">TUNJ_JABATAN</option>
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={addAmount}
                            onChange={(e) => setAddAmount(formatThousands(e.target.value))}
                            placeholder="Nominal (cth: 50.000)"
                            className="w-full rounded border border-emerald-300 bg-white p-1.5 text-[12px] tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpsertManual(addCode, addAmount, false)}
                            disabled={loading || !addAmount}
                            className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tambah
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tambah Pengurang (-) */}
                    <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
                      <h5 className="mb-2 text-[12px] font-bold text-rose-900">
                        - Tambah / Override Pengurang
                      </h5>
                      <div className="space-y-2">
                        <select
                          value={dedCode}
                          onChange={(e) => setDedCode(e.target.value)}
                          className="w-full rounded border border-rose-300 bg-white p-1.5 text-[12px]"
                        >
                          <option value="KASBON">KASBON</option>
                          <option value="POTONGAN_LAIN">POTONGAN_LAIN</option>
                          <option value="DENDA_TELAT">DENDA_TELAT</option>
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dedAmount}
                            onChange={(e) => setDedAmount(formatThousands(e.target.value))}
                            placeholder="Nominal potongan (cth: 100.000)"
                            className="w-full rounded border border-rose-300 bg-white p-1.5 text-[12px] tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpsertManual(dedCode, dedAmount, true)}
                            disabled={loading || !dedAmount}
                            className="inline-flex shrink-0 items-center gap-1 rounded bg-rose-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Potong
                          </button>
                        </div>
                      </div>
                    </div>
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
