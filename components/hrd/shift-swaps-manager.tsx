"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, ArrowLeftRight, Clock, Plus } from "lucide-react";
import { SearchSelect } from "@/components/shared/search-select";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export type ShiftSwapRow = {
  id: string;
  swap_date: string;
  status: string;
  reason: string | null;
  requester_id: string;
  target_employee_id: string;
  requester_name: string;
  target_name: string;
  requester_shift?: string | null;
  target_shift?: string | null;
};

export function ShiftSwapsManager({
  rows = [],
  employees = [],
  userRole = "subordinat",
  canApprove = false,
}: {
  rows: ShiftSwapRow[];
  employees: { id: string; name: string }[];
  userRole: string;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [swapDate, setSwapDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmployeeId) {
      toast.error("Pilih rekan karyawan tujuan tukar shift");
      return;
    }
    if (!swapDate) {
      toast.error("Pilih tanggal shift yang ingin ditukar");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/shift-swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmployeeId,
          swapDate,
          reason,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal mengajukan tukar shift");
        return;
      }

      toast.success("Pengajuan tukar shift berhasil dikirim ke atasan!");
      setOpenModal(false);
      setSwapDate("");
      setReason("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(id: string, decision: "approve" | "reject") {
    setDecidingId(id);
    try {
      const res = await fetch("/api/shift-swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal memproses persetujuan");
        return;
      }

      toast.success(decision === "approve" ? "Tukar shift disetujui & jadwal terupdate!" : "Pengajuan ditolak");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setDecidingId(null);
    }
  }

  const columns: Column<ShiftSwapRow>[] = [
    { key: "swap_date", label: "Tanggal Shift", width: "110px" },
    {
      key: "requester_name",
      label: "Pemohon",
      render: (r) => (
        <div>
          <span className="font-semibold text-gray-900">{r.requester_name}</span>
          {r.requester_shift && <div className="text-[11px] text-gray-500">Shift: {r.requester_shift}</div>}
        </div>
      ),
    },
    {
      key: "target_name",
      label: "Tujuan Tukar",
      render: (r) => (
        <div>
          <span className="font-semibold text-gray-900">{r.target_name}</span>
          {r.target_shift && <div className="text-[11px] text-gray-500">Shift: {r.target_shift}</div>}
        </div>
      ),
    },
    {
      key: "reason",
      label: "Alasan",
      render: (r) => r.reason || "-",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const isApproved = r.status === "approved";
        const isRejected = r.status === "rejected";
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isApproved
                ? "bg-emerald-100 text-emerald-800"
                : isRejected
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {isApproved ? "Disetujui" : isRejected ? "Ditolak" : "Menunggu Persetujuan"}
          </span>
        );
      },
    },
    ...(canApprove
      ? ([
          {
            key: "actions",
            label: "Aksi Persetujuan",
            render: (r: ShiftSwapRow) => {
              if (r.status !== "pending") return <span className="text-[12px] text-gray-400">Selesai</span>;
              const loading = decidingId === r.id;
              return (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDecision(r.id, "approve")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    Setujui
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDecision(r.id, "reject")}
                    className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                    Tolak
                  </button>
                </div>
              );
            },
          },
        ] as Column<ShiftSwapRow>[])
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Header bar & Tombol Modal Pengajuan Tukar Shift */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-500">
          Karyawan dapat mengajukan tukar shift dengan rekan satu outlet. Atasan dan HR Superadmin dapat menyetujui atau menolak.
        </p>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className={btnPrimary}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Ajukan Tukar Shift
        </button>
      </div>

      {/* Modal Popup Pengajuan Tukar Shift */}
      {openModal && (
        <Modal
          title="Form Pengajuan Tukar Shift"
          onClose={() => setOpenModal(false)}
        >
          <form onSubmit={handleApply} className="space-y-4 text-[13px]">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">Rekan Tujuan Tukar Shift</label>
              <SearchSelect
                value={targetEmployeeId}
                onChange={(v) => setTargetEmployeeId(v)}
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="Pilih nama rekan satu tim/outlet..."
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">Tanggal Shift yang Ditukar</label>
              <input
                type="date"
                className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
                value={swapDate}
                onChange={(e) => setSwapDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">Alasan Pertukaran Shift</label>
              <textarea
                rows={2}
                placeholder="Contoh: Ada keperluan mendadak keluarga di pagi hari, sudah koordinasi dengan yang bersangkutan..."
                className="w-full rounded-xl border border-gray-300 p-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setOpenModal(false)}
              >
                Batal
              </button>
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Tabel Riwayat Pengajuan */}
      <div>
        <h2 className="mb-2 text-[15px] font-bold text-gray-900">Riwayat Pengajuan Tukar Shift</h2>
        <DataTable data={rows} columns={columns} exportFilename={`Tukar_Shift_${new Date().toISOString().slice(0, 10)}`} />
      </div>
    </div>
  );
}
