"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Plus, CheckCircle, XCircle, UserCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export type OvertimeRow = {
  id: string;
  employee_id: string;
  full_name: string;
  employee_number: string | null;
  position_name: string | null;
  location_name: string | null;
  overtime_date: string;
  duration_minutes: number;
  payable_hours: string | number;
  flat_rate: string | number;
  status: string;
  notes: string | null;
  requester_name: string | null;
  approver_name: string | null;
  approved_at: string | null;
};

export type EmployeeOption = {
  id: string;
  full_name: string;
  employee_number: string | null;
};

export function OvertimesManager({
  rows,
  employees,
  isSupervisorOrAdmin,
}: {
  rows: OvertimeRow[];
  employees: EmployeeOption[];
  isSupervisorOrAdmin: boolean;
}) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [overtimeDate, setOvertimeDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");
  const [notes, setNotes] = useState("");

  function calcDurationMinutes(start: string, end: string) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) {
      return 0;
    }
    let diff = eh * 60 + em - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff;
  }

  const durationMinutes = calcDurationMinutes(startTime, endTime);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Pilih karyawan yang ditugaskan lembur");
      return;
    }
    if (durationMinutes <= 0) {
      toast.error("Jam mulai dan jam selesai tidak valid");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/overtimes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          overtimeDate,
          startTime,
          endTime,
          durationMinutes,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengajukan lembur");
      toast.success("Pengajuan lembur berhasil dibuat");
      setOpenModal(false);
      setNotes("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    const actionText = action === "approve" ? "menyetujui" : "menolak";
    if (!confirm(`Apakah Anda yakin ingin ${actionText} lembur ini?`)) return;

    try {
      const res = await fetch("/api/overtimes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses aksi");
      toast.success(`Lembur berhasil di-${action === "approve" ? "setujui dan masuk ke payroll" : "tolak"}`);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  const formatRupiah = (val: string | number) =>
    `Rp ${Number(val).toLocaleString("id-ID")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-500">
          Daftar pengajuan jam kerja lembur bawahan dan riwayat persetujuan atasan / HR superadmin.
        </p>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className={btnPrimary}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {isSupervisorOrAdmin ? "Tugaskan / Ajukan Lembur" : "Ajukan Lembur"}
        </button>
      </div>

      <DataTable
        data={rows}
        exportFilename="pengajuan-lembur"
        columns={[
          {
            key: "full_name",
            label: "Karyawan",
            hideable: false,
            render: (row) => (
              <div>
                <div className="font-medium text-gray-900">{row.full_name}</div>
                <div className="text-[11px] text-gray-500">
                  {row.position_name || "-"} • {row.employee_number || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "overtime_date",
            label: "Tanggal Lembur",
            render: (row) =>
              new Date(row.overtime_date).toLocaleDateString("id-ID", {
                timeZone: "Asia/Jakarta",
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
          },
          {
            key: "duration_minutes",
            label: "Durasi (Menit / Jam)",
            numeric: true,
            render: (row) => `${row.duration_minutes} mnt (${Number(row.payable_hours)} jam)`,
          },
          {
            key: "flat_rate",
            label: "Tarif / Jam",
            money: true,
            render: (row) => formatRupiah(row.flat_rate),
          },
          {
            key: "total_upah",
            label: "Total Upah Lembur",
            money: true,
            render: (row) => (
              <span className="font-semibold text-emerald-600">
                {formatRupiah(Number(row.payable_hours) * Number(row.flat_rate))}
              </span>
            ),
          },
          {
            key: "notes",
            label: "Keterangan / Diajukan Oleh",
            render: (row) => (
              <div>
                <div className="text-gray-700">{row.notes || "-"}</div>
                <div className="text-[11px] text-gray-400">
                  Diajukan oleh: {row.requester_name || "-"}
                </div>
              </div>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (row) =>
              row.status === "approved" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  <UserCheck className="h-3 w-3" /> Disetujui
                </span>
              ) : row.status === "rejected" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                  Ditolak
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                  Menunggu Persetujuan
                </span>
              ),
          },
          ...(isSupervisorOrAdmin
            ? [
                {
                  key: "actions",
                  label: "Aksi",
                  includeInExport: false,
                  render: (row: OvertimeRow) =>
                    row.status === "pending" ? (
                      <div className="flex justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleAction(row.id, "approve")}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100 disabled:opacity-50"
                          title="Setujui Lembur"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleAction(row.id, "reject")}
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100 disabled:opacity-50"
                          title="Tolak Lembur"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        Oleh: {row.approver_name || "Admin"}
                      </span>
                    ),
                } satisfies Column<OvertimeRow>,
              ]
            : []),
        ]}
      />
      {openModal && (
        <Modal
          title="Tugaskan Lembur Bawahan (Bisa Backdate)"
          onClose={() => setOpenModal(false)}
        >
          <form onSubmit={handleCreate} className="space-y-3 text-[13px]">
            <div>
              <label className="block text-[12px] font-medium text-gray-700">
                Pilih Karyawan
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_number || "No CW"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700">
                Tanggal Lembur (Bisa Backdate)
              </label>
              <input
                type="date"
                value={overtimeDate}
                onChange={(e) => setOvertimeDate(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Jam Mulai
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Jam Selesai
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
              </div>
            </div>
            <p className="text-[11px] text-gray-500">
              Durasi: <strong>{durationMinutes} menit</strong> ({(durationMinutes / 60).toFixed(1)} jam) — Tarif mengikuti pengaturan sistem.
            </p>

            <div>
              <label className="block text-[12px] font-medium text-gray-700">
                Alasan / Catatan Penugasan Lembur
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Lembur penutupan closing kasir akhir pekan / backdate closing stok..."
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setOpenModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className={btnPrimary}
              >
                Simpan & Ajukan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

