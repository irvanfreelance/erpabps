"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SearchSelect } from "@/components/shared/search-select";
import { btnPrimary } from "@/components/ui/button";

export function BackdateForm({
  employees = [],
}: {
  employees?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [inTime, setInTime] = useState("08:00");
  const [outTime, setOutTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Pilih karyawan");
      return;
    }
    if (!date) {
      toast.error("Pilih tanggal presensi");
      return;
    }
    if (!reason.trim()) {
      toast.error("Alasan koreksi/lupa absen wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const clockInAt = `${date}T${inTime || "08:00"}:00+07:00`;
      const clockOutAt = outTime ? `${date}T${outTime}:00+07:00` : null;

      const res = await fetch("/api/attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backdate: true,
          employeeId,
          attendanceDate: date,
          clockInAt,
          clockOutAt,
          reason,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(typeof json.error === "string" ? json.error : "Ditolak");
        return;
      }

      toast.success("Presensi backdate berhasil disimpan");
      setReason("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <label className="block text-[12px] font-semibold text-gray-700 mb-1">Karyawan</label>
        <SearchSelect
          value={employeeId}
          onChange={(v) => setEmployeeId(v)}
          options={employees.map((e) => ({ value: e.id, label: e.name }))}
          placeholder="Pilih nama karyawan..."
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-gray-700 mb-1">Tanggal Kehadiran</label>
        <input
          type="date"
          className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">Jam Masuk (WIB)</label>
          <input
            type="time"
            className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
            value={inTime}
            onChange={(e) => setInTime(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-gray-700 mb-1">Jam Pulang (WIB, opsional)</label>
          <input
            type="time"
            className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
            value={outTime}
            onChange={(e) => setOutTime(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-gray-700 mb-1">Alasan Koreksi / Lupa Absen (Wajib)</label>
        <textarea
          rows={3}
          placeholder="Contoh: Lupa clock-in karena kendala jaringan di outlet, sudah konfirmasi atasan..."
          className="w-full rounded-xl border border-gray-300 p-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </div>

      <button className={btnPrimary} type="submit" disabled={submitting}>
        {submitting ? "Menyimpan..." : "Simpan Presensi Backdate"}
      </button>
    </form>
  );
}
