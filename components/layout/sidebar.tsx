"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ClipboardList,
  FileText,
  FolderUp,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Menu,
  Plug,
  Puzzle,
  Send,
  Settings,
  Shield,
  Tags,
  Target,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { NAV } from "@/lib/nav";
import type { OrgProfile } from "@/types/org";

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  "/dashboard": LayoutDashboard,
  "/worklist": ClipboardList,
  "/donors": Users,
  "/programs": Bookmark,
  "/campaigns": Megaphone,
  "/transactions": Wallet,
  "/segments": Target,
  "/blast-batches": Send,
  "/prospect-notes": FileText,
  "/vendor-profiles": Plug,
  "/field-definitions": Settings,
  "/tags": Tags,
  "/users": KeyRound,
  "/data-imports": FolderUp,
  "/extensions": Puzzle,
  "/app-config": Wrench,
};

export function AppShell({
  children,
  userNama,
  userEmail,
  org,
}: {
  children: React.ReactNode;
  userNama: string;
  userEmail: string;
  org: OrgProfile;
}) {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const logoSrc = org.logo_url
    ? `${org.logo_url}${org.logo_url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(org.updated_at ?? "1"))}`
    : "";

  useEffect(() => {
    setLogoOk(true);
  }, [org.logo_url, org.updated_at]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      const isDesktop = mq.matches;
      setMobile(!isDesktop);
      if (isDesktop) setDrawer(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const showLabels = mobile || !collapsed;
  const width = mobile ? 280 : collapsed ? 64 : 220;

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[#f4f5f7] text-[14px] text-[#1a1a1a]">
      {mobile && drawer && (
        <button
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
          onClick={() => setDrawer(false)}
          aria-label="Tutup menu"
        />
      )}
      <aside
        className="z-50 flex h-full shrink-0 flex-col overflow-hidden text-white transition-transform duration-200 md:transition-[width]"
        style={{
          background: org.sidebar_color,
          width,
          minWidth: mobile ? 280 : width,
          position: mobile ? "fixed" : "relative",
          top: 0,
          bottom: 0,
          transform: mobile && !drawer ? "translateX(-100%)" : "translateX(0)",
        }}
        aria-hidden={mobile && !drawer}
        inert={mobile && !drawer ? true : undefined}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/15 px-3 py-3">
          <div className="min-w-0">
            {logoSrc && logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={org.nama_singkat}
                className="h-8 max-w-[160px] object-contain"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <Shield size={16} />
                {showLabels && <span className="truncate text-[13px] font-bold">{org.nama_singkat}</span>}
              </div>
            )}
            {showLabels && <div className="mt-1 truncate text-[10px] opacity-50">{org.tagline}</div>}
          </div>
          {mobile ? (
            <button className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80" onClick={() => setDrawer(false)} aria-label="Tutup">
              <X size={20} />
            </button>
          ) : (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Bentangkan menu" : "Ciutkan menu"}
            >
              <ChevronLeft size={18} className={collapsed ? "rotate-180" : ""} />
            </button>
          )}
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto py-1" aria-label="Menu utama">
          {NAV.map((g) => (
            <div key={g.group}>
              {showLabels && (
                <div className="px-4 pt-3 pb-1 text-[10px] font-bold tracking-widest uppercase opacity-45">{g.group}</div>
              )}
              {g.items.map((it) => {
                const Icon = ICONS[it.href] ?? LayoutDashboard;
                const on = active(it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    title={it.label}
                    className="flex min-h-11 items-center gap-2.5 py-2 pr-3 pl-3.5 text-[13px] hover:bg-white/10"
                    style={{
                      fontWeight: on ? 700 : 400,
                      background: on ? "rgba(255,255,255,.16)" : "transparent",
                      borderLeft: on ? "3px solid #fff" : "3px solid transparent",
                    }}
                  >
                    <Icon size={17} strokeWidth={on ? 2.5 : 1.8} />
                    {showLabels && <span className="truncate">{it.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-white/15 px-3 py-3">
          {showLabels && (
            <div className="mb-2 min-w-0 px-1">
              <div className="truncate text-[13px] font-semibold">{userNama}</div>
              <div className="truncate text-[11px] text-white/70">{userEmail}</div>
            </div>
          )}
          <LogoutButton tone="sidebar" showLabel={showLabels} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#e8e8e8] bg-white px-3 md:h-14 md:px-5">
          {mobile && (
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--primary)]"
              onClick={() => setDrawer(true)}
              aria-label="Buka menu"
            >
              <Menu size={22} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-[#333] md:text-[14px]">{org.nama}</div>
            <div className="hidden truncate text-[11px] text-[#888] sm:block">{org.tagline}</div>
          </div>
          <LogoutButton className="md:hidden" />
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
