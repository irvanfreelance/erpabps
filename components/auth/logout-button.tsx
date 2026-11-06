"use client";

import { LogOut } from "lucide-react";
import { markSignedOut } from "@/lib/auth/ui-gate";
import { cn } from "@/lib/utils/cn";

export function LogoutButton({
  tone = "header",
  showLabel = true,
  className,
}: {
  tone?: "header" | "sidebar";
  showLabel?: boolean;
  className?: string;
}) {
  function logout() {
    markSignedOut();
    window.location.assign("/login");
  }

  if (tone === "sidebar") {
    return (
      <button
        type="button"
        onClick={logout}
        aria-label="Keluar"
        title="Keluar"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white hover:bg-white/25"
      >
        <LogOut size={16} />
        {showLabel ? "Keluar" : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      className={cn(
        "ml-auto inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#ddd] bg-white px-3 text-[13px] font-semibold text-[#333]",
        className,
      )}
    >
      <LogOut size={16} />
      Keluar
    </button>
  );
}
