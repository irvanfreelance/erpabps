"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, CalendarCheck, FileText } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { btnPrimary } from "@/components/ui/button";

export type LeaveRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  reviewer_name: string | null;
  reviewed_at_wib: string | null;
  created_at: string;
};

export function LeavesManager({
  rows = [],
  userRole = "subordinat",
  canApprove = false,
}: {
  rows: LeaveRow[];
  userRole: string;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const [leaveType, setLeaveType] = useState<"cuti" | "izin" | "sakit">("cuti");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Tentukan tanggal mulai dan selesai");
      return;
    }
    if (endDate < startDate) {
      toast.error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai");
      return;
    }
    if (!reason.trim()) {
      toast.error("Alasan pengajuan wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType,
          startDate,
          endDate,
          reason,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal mengajukan permohonan");
        return;
      }

      toast.success("Pengajuan cuti/izin berhasil dikirim ke atasan!");
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
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal memproses persetujuan");
        return;
      }

      toast.success(decision === "approve" ? "Pengajuan disetujui & jadwal terupdate libur!" : "Pengajuan ditolak");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setDecidingId(null);
    }
  }

  const columns: Column<LeaveRow>[] = [
    {
      key: "employee_name",
      label: "Karyawan",
      render: (r) => (
        <div>
          <span className="font-semibold text-gray-900">{r.employee_name}</span>
          <div className="text-[11px] text-gray-400">{r.employee_number || "-"}</div>
        </div>
      ),
    },
    {
      key: "leave_type",
      label: "Jenis",
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            r.leave_type === "cuti"
              ? "bg-purple-100 text-purple-800"
              : r.leave_type === "sakit"
                ? "bg-blue-100 text-blue-800"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {r.leave_type.toUpperCase()}
        </span>
      ),
    },
    {
      key: "dates",
      label: "Periode",
      render: (r) => (
        <div className="text-[13px] font-medium text-gray-800">
          {r.start_date} {r.start_date !== r.end_date ? `s.d ${r.end_date}` : ""}
        </div>
      ),
    },
    {
      key: "reason",
      label: "Alasan",
      render: (r) => r.reason,
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
            render: (r: LeaveRow) => {
              if (r.status !== "pending") {
                return (
                  <div className="text-[11px] text-gray-400">
                    Oleh: {r.reviewer_name || "Atasan"} ({r.reviewed_at_wib || "-"})
                  </div>
                );
              }
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
        ] as Column<LeaveRow>[])
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Form Pengajuan Cuti / Izin */}
      <form onSubmit={handleApply} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm max-w-xl space-y-4">
        <div className="flex items-center gap-2 text-[var(--primary)] font-bold text-[16px]">
          <CalendarCheck className="h-5 w-5" />
          <span>Form Pengajuan Cuti / Izin / Sakit</span>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">Jenis Pengajuan</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "cuti", label: "Cuti" },
              { id: "izin", label: "Izin" },
              { id: "sakit", label: "Sakit" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLeaveType(t.id as never)}
                className={`rounded-xl py-2 text-[12px] font-semibold border transition-all ${
                  leaveType === t.id
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Mulai Tanggal</label>
            <input
              type="date"
              className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">Alasan Pengajuan</label>
          <textarea
            rows={3}
            placeholder="Jelaskan alasan pengajuan cuti atau keperluan izin..."
            className="w-full rounded-xl border border-gray-300 p-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>

        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? "Mengirim..." : "Kirim Pengajuan Cuti"}
        </button>
      </form>

      {/* Tabel Riwayat Pengajuan */}
      <div>
        <h2 className="mb-2 text-[16px] font-bold text-gray-900">Riwayat Pengajuan Cuti & Izin</h2>
        <DataTable data={rows} columns={columns} exportFilename={`Pengajuan_Cuti_${new Date().toISOString().slice(0, 10)}`} />
      </div>
    </div>
  );
}
