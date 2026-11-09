"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Eye } from "lucide-react";
import { exportPayslipPdf, PayslipItem, PayslipDetail } from "@/lib/utils/export-payslip-pdf";
import { toast } from "sonner";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export function PayslipsTable({ rows }: { rows: PayslipItem[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<{ item: PayslipItem; details: PayslipDetail[] } | null>(null);

  async function handleDownloadPdf(item: PayslipItem) {
    try {
      setLoadingId(item.id);
      const res = await fetch(`/api/payroll-items/${item.id}`);
      if (!res.ok) throw new Error("Gagal mengambil rincian slip gaji");
      const data = await res.json();
      exportPayslipPdf(data.item, data.details, data.org?.nama, data.org?.tagline);
      toast.success("Slip gaji berhasil diunduh");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan saat mengunduh PDF");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleViewDetail(item: PayslipItem) {
    try {
      setLoadingId(item.id);
      const res = await fetch(`/api/payroll-items/${item.id}`);
      if (!res.ok) throw new Error("Gagal mengambil rincian slip gaji");
      const data = await res.json();
      setSelectedSlip({ item: data.item, details: data.details });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan saat membuka detail");
    } finally {
      setLoadingId(null);
    }
  }

  const formatRupiah = (val: string | number) =>
    `Rp ${Number(val).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b bg-gray-50 text-[12px] font-semibold text-gray-700">
            <tr>
              <th className="px-3 py-2.5">Karyawan</th>
              <th className="px-3 py-2.5">Jabatan / Kelompok</th>
              <th className="px-3 py-2.5">Periode Gaji</th>
              <th className="px-3 py-2.5 text-right">Menit Hadir</th>
              <th className="px-3 py-2.5 text-right">Telat</th>
              <th className="px-3 py-2.5 text-right">Penghasilan</th>
              <th className="px-3 py-2.5 text-right">Potongan</th>
              <th className="px-3 py-2.5 text-right font-bold text-[var(--primary)]">Gaji Bersih</th>
              <th className="px-3 py-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-400">
                  Belum ada data slip gaji yang tersedia untuk Anda.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">
                    <div>{row.full_name}</div>
                    <div className="text-[11px] text-gray-500">{row.employee_number || "-"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    <div>{row.position_name || "-"}</div>
                    <div className="text-[11px] text-gray-400">{row.pay_group_name || "-"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {row.period_start} s/d {row.period_end}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {row.payable_minutes} mnt ({Math.round(row.payable_minutes / 60)} jam)
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.late_minutes > 0 ? (
                      <span className="font-semibold text-rose-600">{row.late_minutes} mnt</span>
                    ) : (
                      <span className="text-gray-400">0 mnt</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">
                    {formatRupiah(row.earnings_total)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-rose-600">
                    {formatRupiah(row.deduction_total)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-[var(--primary)]">
                    {formatRupiah(row.net_pay)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleViewDetail(row)}
                        disabled={loadingId === row.id}
                        className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
                        title="Lihat Detail Slip"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(row)}
                        disabled={loadingId === row.id}
                        className="inline-flex items-center gap-1 rounded bg-[var(--primary)] px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:opacity-90"
                        title="Unduh Slip Gaji PDF"
                      >
                        {loadingId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedSlip && (
        <Modal
          title={`Rincian Slip Gaji — ${selectedSlip.item.full_name}`}
          onClose={() => setSelectedSlip(null)}
        >
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-3 text-[12px]">
              <div>
                <span className="text-gray-500">Periode:</span>{" "}
                <strong className="text-gray-800">
                  {selectedSlip.item.period_start} s/d {selectedSlip.item.period_end}
                </strong>
              </div>
              <div>
                <span className="text-gray-500">Kelompok:</span>{" "}
                <strong className="text-gray-800">{selectedSlip.item.pay_group_name}</strong>
              </div>
              <div>
                <span className="text-gray-500">Jabatan:</span>{" "}
                <strong className="text-gray-800">{selectedSlip.item.position_name}</strong>
              </div>
              <div>
                <span className="text-gray-500">Total Jam/Menit Hadir:</span>{" "}
                <strong className="text-gray-800">{selectedSlip.item.payable_minutes} Menit</strong>
              </div>
            </div>

            <div>
              <h4 className="mb-1 text-[12px] font-bold uppercase tracking-wider text-gray-500">
                Komponen Rincian Gaji
              </h4>
              <table className="w-full text-left text-[12px]">
                <thead className="border-b bg-gray-100 text-gray-600">
                  <tr>
                    <th className="p-1.5">Komponen</th>
                    <th className="p-1.5">Qty / Ket</th>
                    <th className="p-1.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedSlip.details.map((d) => (
                    <tr key={d.id}>
                      <td className="p-1.5 font-medium text-gray-800">
                        {d.component_code}
                        {d.source_ref === "manual_override" && (
                          <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-800">
                            Override
                          </span>
                        )}
                      </td>
                      <td className="p-1.5 text-gray-500">
                        {d.quantity > 1 ? `${d.quantity} x @${formatRupiah(d.unit_rate)}` : "-"}
                      </td>
                      <td
                        className={`p-1.5 text-right font-medium ${
                          Number(d.amount) >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {formatRupiah(d.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-600">Total Penghasilan:</span>
                <span className="font-semibold text-emerald-600">
                  {formatRupiah(selectedSlip.item.earnings_total)}
                </span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-600">Total Potongan:</span>
                <span className="font-semibold text-rose-600">
                  - {formatRupiah(selectedSlip.item.deduction_total)}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-[14px] font-bold text-[var(--primary)]">
                <span>Gaji Bersih (Netto):</span>
                <span>{formatRupiah(selectedSlip.item.net_pay)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setSelectedSlip(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  handleDownloadPdf(selectedSlip.item);
                }}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Cetak Slip PDF
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
