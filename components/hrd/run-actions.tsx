"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export function RunActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const frozen = status === "approved" || status === "paid";

  async function act(action: string) {
    const res = await fetch(`/api/payroll-runs/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal");
      return;
    }
    toast.success(action === "approve" ? "Disetujui dan dibekukan" : "Dihitung");
    router.refresh();
  }

  return (
    <div className="mb-3 flex gap-2">
      <button className={btnSecondary} type="button" disabled={frozen} onClick={() => act("calculate")}>
        Hitung ulang
      </button>
      <button className={btnPrimary} type="button" disabled={frozen} onClick={() => act("approve")}>
        Setujui
      </button>
    </div>
  );
}
