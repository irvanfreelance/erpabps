"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Plus, CheckCircle, XCircle, UserCheck } from "lucide-react";
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
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [hourlyRate, setHourlyRate] = useState(25000);
  const [notes, setNotes] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Pilih karyawan yang ditugaskan lembur");
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
          durationMinutes: Number(durationMinutes),
          hourlyRate: Number(hourlyRate),
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
        {isSupervisorOrAdmin && (
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className={btnPrimary}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Tugaskan / Ajukan Lembur
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b bg-[var(--primary)] text-[12px] font-semibold text-white">
            <tr>
              <th className="px-3 py-2.5">Karyawan</th>
              <th className="px-3 py-2.5">Tanggal Lembur</th>
              <th className="px-3 py-2.5 text-right">Durasi (Menit / Jam)</th>
              <th className="px-3 py-2.5 text-right">Tarif / Jam</th>
              <th className="px-3 py-2.5 text-right">Total Upah Lembur</th>
              <th className="px-3 py-2.5">Keterangan / Diajukan Oleh</th>
              <th className="px-3 py-2.5 text-center">Status</th>
              {isSupervisorOrAdmin && <th className="px-3 py-2.5 text-center">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isSupervisorOrAdmin ? 8 : 7} className="py-8 text-center text-gray-400">
                  Belum ada data pengajuan lembur yang tercatat.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const hours = Number(row.payable_hours) || Number(row.duration_minutes) / 60;
                const total = Math.round(hours * Number(row.flat_rate));

                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      <div>{row.full_name}</div>
                      <div className="text-[11px] text-gray-400">
                        {row.position_name || "-"} · {row.employee_number || "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">
                      {row.overtime_date}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 font-medium">
                      {row.duration_minutes} mnt ({hours} jam)
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {formatRupiah(row.flat_rate)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                      {formatRupiah(total)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 text-[12px]">
                      <div>{row.notes || "-"}</div>
                      {row.requester_name && (
                        <div className="text-[11px] text-gray-400">
                          Diajukan oleh: {row.requester_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.status === "approved" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Disetujui
                        </span>
                      ) : row.status === "rejected" ? (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          Ditolak
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Menunggu Persetujuan
                        </span>
                      )}
                    </td>
                    {isSupervisorOrAdmin && (
                      <td className="px-3 py-2.5 text-center">
                        {row.status === "pending" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAction(row.id, "approve")}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                              title="Setujui Lembur"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(row.id, "reject")}
                              className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700"
                              title="Tolak Lembur"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400">
                            {row.approver_name ? `Oleh: ${row.approver_name}` : "Selesai"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openModal && (
        <Modal
          title="Tugaskan Lembur Bawahan (Bisa Backdate)"
          onClose={() => setOpenModal(false)}
        >
          <form onSubmit={handleCreate} className="space-y-3 text-[13px]">
            <div>
              <label className="block text-[12px] font-medium text-gray-700">
                Pilih Karyawan Bawahan
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
                  Durasi Lembur (Menit)
                </label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
                <span className="text-[11px] text-gray-400">
                  = {(durationMinutes / 60).toFixed(1)} Jam
                </span>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700">
                  Tarif Lembur / Jam (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-[13px]"
                />
                <span className="text-[11px] text-gray-400">
                  Total: {formatRupiah((durationMinutes / 60) * hourlyRate)}
                </span>
              </div>
            </div>

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

