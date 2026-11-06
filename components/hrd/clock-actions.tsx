"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export function ClockActions() {
  const router = useRouter();

  async function punch(kind: "in" | "out") {
    const res = await fetch("/api/attendances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal");
      return;
    }
    toast.success(kind === "in" ? "Clock-in tercatat" : "Clock-out tercatat");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button className={btnPrimary} type="button" onClick={() => punch("in")}>
        Clock-in
      </button>
      <button className={btnSecondary} type="button" onClick={() => punch("out")}>
        Clock-out
      </button>
    </div>
  );
}
