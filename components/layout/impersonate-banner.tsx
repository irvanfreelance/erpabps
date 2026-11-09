"use client";

import { useState } from "react";
import { UserCheck, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ImpersonateBanner({
  impersonatedBy,
  currentNama,
  currentRole,
}: {
  impersonatedBy: { id: string; nama: string; email: string };
  currentNama: string;
  currentRole: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/impersonate", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Gagal menghentikan impersonasi");
      }
      toast.success("Kembali ke akun Superadmin");
      window.location.href = "/employees";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-white shadow-md">
      <div className="flex items-center gap-2 text-xs md:text-sm font-medium">
        <UserCheck size={18} className="shrink-0" />
        <span>
          Sedang login sebagai <strong>{currentNama}</strong> (Peran:{" "}
          <span className="uppercase font-bold tracking-wider">{currentRole}</span>). Sesi asli Anda:{" "}
          <strong>{impersonatedBy.nama}</strong>.
        </span>
      </div>
      <button
        type="button"
        onClick={handleStop}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-black/25 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black/40 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
        <span>Keluar Impersonate</span>
      </button>
    </div>
  );
}

