"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export function ScreenActions({ id }: { id: string }) {
  const router = useRouter();
  async function screen(passed: boolean) {
    const res = await fetch("/api/cash-advances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screen: true, id, passed }),
    });
    if (!res.ok) {
      toast.error("Ditolak");
      return;
    }
    toast.success(passed ? "Lolos" : "Ditolak");
    router.refresh();
  }
  return (
    <div className="flex gap-1">
      <button className={btnPrimary} type="button" onClick={() => screen(true)}>
        Lolos
      </button>
      <button className={btnSecondary} type="button" onClick={() => screen(false)}>
        Tolak
      </button>
    </div>
  );
}
