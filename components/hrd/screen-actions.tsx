"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ScreenActions({ id }: { id: string }) {
  const router = useRouter();
  async function screen(passed: boolean) {
    const res = await fetch("/api/cash-advances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screen: true, id, passed }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error(data?.error ?? "Gagal memproses");
      return;
    }
    toast.success(passed ? "Approved" : "Rejected");
    router.refresh();
  }
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => screen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 transition-colors hover:bg-emerald-100"
      >
        <CheckCircle2 size={14} />
        Approve
      </button>
      <button
        type="button"
        onClick={() => screen(false)}
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-colors hover:bg-rose-100"
      >
        <XCircle size={14} />
        Reject
      </button>
    </div>
  );
}
