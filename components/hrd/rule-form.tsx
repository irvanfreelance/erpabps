"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { btnPrimary } from "@/components/ui/button";

export function RuleForm({ keys }: { keys: string[] }) {
  const router = useRouter();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: String(fd.get("key")),
        scopeType: String(fd.get("scopeType")),
        scopeId: String(fd.get("scopeId") || "") || null,
        value: String(fd.get("value")),
        effectiveFrom: String(fd.get("effectiveFrom")),
        sourceRef: String(fd.get("sourceRef")),
        reason: String(fd.get("reason")),
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal");
      return;
    }
    toast.success("Aturan tersimpan");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mb-4 grid max-w-xl gap-2">
      <select name="key" className="min-h-11 rounded-xl border px-3">
        {keys.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      <select name="scopeType" className="min-h-11 rounded-xl border px-3">
        <option value="org">org</option>
        <option value="pay_group">pay_group</option>
        <option value="location">location</option>
        <option value="position">position</option>
        <option value="employee">employee</option>
      </select>
      <input name="scopeId" placeholder="scope id (kosong untuk lembaga)" className="min-h-11 rounded-xl border px-3" />
      <input name="value" placeholder="nilai" className="min-h-11 rounded-xl border px-3" required />
      <input name="effectiveFrom" type="date" className="min-h-11 rounded-xl border px-3" required />
      <input name="sourceRef" placeholder="doc_erp_abs_stok / sheet / manual" className="min-h-11 rounded-xl border px-3" required />
      <input name="reason" placeholder="Alasan" className="min-h-11 rounded-xl border px-3" required />
      <button className={btnPrimary} type="submit">
        Simpan nilai
      </button>
    </form>
  );
}
