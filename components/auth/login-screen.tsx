"use client";

import { useState } from "react";
import { markSignedIn, safeNextPath } from "@/lib/auth/ui-gate";
import type { OrgProfile } from "@/types/org";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72A5.4 5.4 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function GoogleButton({ pending, onClick, className = "" }: { pending: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white px-4 text-[15px] font-semibold text-[#3c4043] shadow-sm hover:bg-[#f8f9fa] disabled:opacity-60 ${className}`}
    >
      <GoogleMark />
      {pending ? "Membuka CRM…" : "Masuk dengan Google"}
    </button>
  );
}

export function LoginScreen({ org }: { org: OrgProfile }) {
  const [pending, setPending] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const logoSrc = org.logo_url
    ? `${org.logo_url}${org.logo_url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(org.updated_at ?? "1"))}`
    : "";

  function enter() {
    if (pending) return;
    setPending(true);
    markSignedIn();
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    window.location.assign(next);
  }

  function Logo() {
    if (logoSrc && logoOk) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="h-8 max-w-[148px] object-contain" onError={() => setLogoOk(false)} />
      );
    }
    return <span className="text-[15px] font-bold text-[var(--primary)]">{org.nama_singkat}</span>;
  }

  return (
    <div
      style={
        {
          "--primary": org.primary_color,
          "--sidebar": org.sidebar_color,
          "--accent": org.accent_color,
        } as React.CSSProperties
      }
    >
      <div className="relative grid min-h-dvh grid-rows-[1fr_auto_1fr] overflow-hidden bg-[var(--sidebar)] px-6 text-white md:hidden">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-10 -left-16 h-40 w-40 rounded-full bg-[var(--accent)]/40" />
        <div className="relative flex flex-col justify-end pb-8">
          <div className="inline-flex h-14 w-fit items-center rounded-2xl bg-white px-3 shadow-sm">
            <Logo />
          </div>
          <h1 className="mt-6 mb-0 text-[30px] font-bold leading-tight">{org.nama}</h1>
          <p className="mt-2 mb-0 text-[15px] text-white/80">{org.tagline || "CRM donatur internal"}</p>
        </div>
        <div className="relative">
          <GoogleButton pending={pending} onClick={enter} />
        </div>
        <div />
      </div>

      <div className="hidden min-h-dvh md:flex">
        <section className="flex w-[42%] max-w-xl flex-col justify-center gap-6 bg-[var(--sidebar)] px-10 py-12 text-white">
          <div className="flex h-14 w-fit items-center rounded-2xl bg-white px-3">
            <Logo />
          </div>
          <div>
            <h1 className="m-0 text-[32px] font-bold leading-tight">{org.nama}</h1>
            <p className="mt-2 mb-0 max-w-sm text-[15px] text-white/80">{org.tagline || "CRM donatur internal"}</p>
          </div>
        </section>
        <section className="flex flex-1 items-center justify-center bg-[#f4f5f7] px-8 py-8">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="m-0 text-[22px] font-bold text-[var(--primary)]">Login</h2><p>&nbsp;</p>
            
            <GoogleButton pending={pending} onClick={enter} className="min-h-11 text-[14px]" />
            
          </div>
        </section>
      </div>
    </div>
  );
}
