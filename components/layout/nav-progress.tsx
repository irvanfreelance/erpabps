"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgressBar() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Selesai navigasi ketika pathname berubah
    setNavigating(false);
  }, [pathname]);

  useEffect(() => {
    // Intercept klik pada link internal atau table row link
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a, tr[class*='cursor-pointer']");
      if (!target) return;

      // Jika tombol aksi atau non-link di-klik
      if ((e.target as HTMLElement).closest("button, input, select")) return;

      // Jika link href mengarah ke internal navigation
      const href = target.getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("#") && href !== pathname) {
        startTransition(() => {
          setNavigating(true);
        });
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [pathname]);

  if (!navigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 overflow-hidden bg-emerald-100">
      <div className="h-full bg-[var(--primary)] animate-[indeterminate_1.2s_infinite_linear] origin-left"></div>
      <style jsx>{`
        @keyframes indeterminate {
          0% {
            transform: translateX(-100%) scaleX(0.2);
          }
          50% {
            transform: translateX(20%) scaleX(0.6);
          }
          100% {
            transform: translateX(100%) scaleX(0.2);
          }
        }
      `}</style>
    </div>
  );
}

