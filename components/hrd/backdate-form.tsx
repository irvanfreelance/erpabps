"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { btnPrimary } from "@/components/ui/button";

export function BackdateForm() {
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/attendances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        backdate: true,
        employeeId: String(fd.get("employeeId") ?? ""),
        attendanceDate: String(fd.get("attendanceDate") ?? ""),
        clockInAt: String(fd.get("clockInAt") ?? ""),
        clockOutAt: String(fd.get("clockOutAt") || "") || null,
        reason: String(fd.get("reason") ?? ""),
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Ditolak");
      return;
    }
    toast.success("Backdate tercatat");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-2">
      <input name="employeeId" placeholder="ID karyawan" className="min-h-11 rounded-xl border px-3" required />
      <input name="attendanceDate" type="date" className="min-h-11 rounded-xl border px-3" required />
      <input name="clockInAt" placeholder="2026-11-06T08:00:00+07:00" className="min-h-11 rounded-xl border px-3" required />
      <input name="clockOutAt" placeholder="Clock-out opsional" className="min-h-11 rounded-xl border px-3" />
      <textarea name="reason" placeholder="Alasan wajib" className="min-h-24 rounded-xl border px-3 py-2" required />
      <button className={btnPrimary} type="submit">
        Simpan backdate
      </button>
    </form>
  );
}
