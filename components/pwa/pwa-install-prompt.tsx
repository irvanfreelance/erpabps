"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pwa_install_dismissed_until";
const DISMISS_DAYS = 7;

export function PwaInstallPrompt({ appName }: { appName: string }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker for PWA installability
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore registration errors in unsupported/private contexts
      });
    }

    // Already running as installed PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Check if user recently dismissed the prompt
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
      if (Date.now() < until) return;
    } catch {
      // Ignore storage errors
    }

    setDismissed(false);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Detect iOS (no beforeinstallprompt support on Safari or Chrome iOS)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    if (isIos) {
      setShowIosHint(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // Ignore storage errors
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  };

  if (dismissed || (!deferredPrompt && !showIosHint)) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-3 z-50 mx-auto max-w-md px-3">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background/95 p-3.5 shadow-lg backdrop-blur">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {showIosHint ? (
            <Share className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Pasang {appName} di HP
          </p>
          {showIosHint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ketuk ikon <span className="font-medium text-foreground">Bagikan</span> di
              bawah, lalu pilih{" "}
              <span className="font-medium text-foreground">
                Tambah ke Layar Utama
              </span>{" "}
              untuk akses cepat tanpa buka browser.
            </p>
          ) : deferredPrompt ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tambahkan shortcut ke layar utama agar lebih cepat dibuka tanpa
              membuka browser.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ketuk menu browser (<span className="font-medium text-foreground">⋮</span>)
              lalu pilih{" "}
              <span className="font-medium text-foreground">
                Tambahkan ke layar utama
              </span>{" "}
              untuk akses cepat.
            </p>
          )}
          {!showIosHint && deferredPrompt && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                Pasang Sekarang
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
              >
                Nanti
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Tutup"
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

