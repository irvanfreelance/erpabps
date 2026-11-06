"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { btnPrimary } from "@/components/ui/button";

export function PolicyForm() {
  const router = useRouter();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/approval-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: String(fd.get("category") || "general"),
        requiresApproval: fd.get("requiresApproval") === "on",
        approverRoles: ["superadmin"],
        minApprovers: Number(fd.get("minApprovers") || 1),
        effectiveFrom: String(fd.get("effectiveFrom")),
        reason: String(fd.get("reason")),
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal");
      return;
    }
    toast.success("Kebijakan tersimpan");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mb-4 grid max-w-xl gap-2">
      <input name="category" placeholder="Kategori" className="min-h-11 rounded-xl border px-3" />
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="requiresApproval" /> Perlu persetujuan
      </label>
      <input name="minApprovers" type="number" defaultValue={1} className="min-h-11 rounded-xl border px-3" />
      <input name="effectiveFrom" type="date" className="min-h-11 rounded-xl border px-3" required />
      <input name="reason" placeholder="Alasan" className="min-h-11 rounded-xl border px-3" required />
      <button className={btnPrimary} type="submit">
        Simpan kebijakan
      </button>
    </form>
  );
}
