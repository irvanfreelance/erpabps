"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Clock,
  FileText,
  Gift,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Menu,
  Scale,
  Settings,
  Shield,
  Timer,
  Users,
  Wallet,
  X,
  Package,
  Boxes,
  Truck,
  ShoppingCart,
  Factory,
  Layers,
  BarChart3,
  Receipt,
  CircleDollarSign,
  Undo2,
  Tags,
  Warehouse,
  Briefcase,
  Store,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { navForRole } from "@/lib/nav";
import type { Role } from "@/types/auth";
import type { OrgProfile } from "@/types/org";

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  // HR
  "/dashboard": LayoutDashboard,
  "/attendances/clock": Timer,
  "/attendances": ClipboardList,
  "/attendances/backdate": Timer,
  "/schedules": CalendarDays,
  "/shift-templates": CalendarDays,
  "/shift-swaps": CalendarDays,
  "/leaves": CalendarDays,
  "/overtimes": Clock,
  "/employees": Users,
  "/payroll-runs": Wallet,
  "/payslips": FileText,
  "/cash-advances": Wallet,
  "/cash-advances/screening": Scale,
  "/bonus/outlet-revenues": Gift,
  "/bonus/monthly": Gift,
  "/contract-stages": FileText,
  "/contracts": FileText,
  "/reports/attendance": ClipboardList,
  "/reports/payroll": Wallet,
  "/master/locations": MapPin,
  "/master/positions": Users,
  "/master/ranks": Users,
  "/master/employee-types": Users,
  "/master/pay-groups": Wallet,
  "/master/salary-components": Wallet,
  "/master/holidays": CalendarDays,
  "/settings": Settings,
  "/settings/rules": Settings,
  "/users": KeyRound,
  "/approvals": Scale,
  "/approvals/policies": Scale,

  // Stock
  "/stock/purchase-requests": ShoppingCart,
  "/stock/purchase-orders": FileText,
  "/stock/goods-receipts": Truck,
  "/stock/vendor-bills": Receipt,
  "/stock/vendor-payments": CircleDollarSign,
  "/stock/cash-funds": Wallet,
  "/stock/production-orders": Factory,
  "/stock/boms": Layers,
  "/stock/sales-orders": ShoppingCart,
  "/stock/shipments": Truck,
  "/stock/sales-invoices": Receipt,
  "/stock/price-lists": Tags,
  "/stock/balances": Boxes,
  "/stock/moves": ClipboardList,
  "/stock/counts": Scale,
  "/stock/reversals": Undo2,
  "/stock/items": Package,
  "/stock/bins": Warehouse,
  "/stock/parties": Store,
  "/stock/categories": Tags,
  "/stock/uoms": Scale,
  "/stock/reports": BarChart3,
};

export function AppShell({
  children,
  userNama,
  userEmail,
  userRole,
  org,
}: {
  children: React.ReactNode;
  userNama: string;
  userEmail: string;
  userRole: Role;
  org: OrgProfile;
}) {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  // Default module follows current route, or stored preference
  const isStockPath = pathname.startsWith("/stock");
  const [activeModule, setActiveModule] = useState<"hr" | "stock">(isStockPath ? "stock" : "hr");

  const logoSrc = org.logo_url
    ? `${org.logo_url}${org.logo_url.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(org.updated_at ?? "1"))}`
    : "";

  useEffect(() => {
    setLogoOk(true);
  }, [org.logo_url, org.updated_at]);

  useEffect(() => {
    if (pathname.startsWith("/stock")) {
      setActiveModule("stock");
    } else {
      setActiveModule("hr");
    }
  }, [pathname]);

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
  const isSuperadmin = userRole === "superadmin";
  const showLabels = mobile || !collapsed;

  // Rail width is 56px (when superadmin on desktop). Sub-sidebar width is standard 220px or 64px collapsed.
  const railWidth = !mobile && isSuperadmin ? 58 : 0;
  const subWidth = mobile ? 280 : collapsed ? 64 : 220;
  const totalWidth = mobile ? 280 : railWidth + subWidth;

  const currentNavGroups = navForRole(userRole, isSuperadmin ? activeModule : "hr");

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[#f4f5f7] text-[14px] text-[#1a1a1a]">
      {mobile && drawer && (
        <button
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
          onClick={() => setDrawer(false)}
          aria-label="Tutup menu"
        />
      )}

      {/* Main Container Sidebar (Double Sidebar for Desktop) */}
      <aside
        className="z-50 flex h-full shrink-0 flex-row overflow-hidden text-white transition-transform duration-200 md:transition-[width]"
        style={{
          width: totalWidth,
          minWidth: mobile ? 280 : totalWidth,
          position: mobile ? "fixed" : "relative",
          top: 0,
          bottom: 0,
          transform: mobile && !drawer ? "translateX(-100%)" : "translateX(0)",
        }}
        aria-hidden={mobile && !drawer}
        inert={mobile && !drawer ? true : undefined}
      >
        {/* Module Switcher Rail (Primary Sidebar) */}
        {!mobile && isSuperadmin && (
          <div
            className="flex w-[58px] shrink-0 flex-col items-center justify-between border-r border-black/20 py-3"
            style={{
              background: "rgba(0, 0, 0, 0.22)",
              backgroundColor: org.sidebar_color,
              filter: "brightness(0.9)",
            }}
          >
            <div className="flex flex-col items-center gap-4 w-full">
              {/* Org Logo / Icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white shadow-xs">
                <Shield size={20} />
              </div>

              {/* Module Buttons */}
              <div className="flex flex-col items-center gap-2 w-full px-1.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModule("hr")}
                  title="Modul HR & Payroll"
                  className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition-all ${
                    activeModule === "hr"
                      ? "bg-white text-[var(--sidebar)] shadow-md font-bold"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Users size={19} />
                  <span className="mt-0.5 scale-90">HR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModule("stock")}
                  title="Modul Stok & HPP"
                  className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl text-[10px] font-semibold transition-all ${
                    activeModule === "stock"
                      ? "bg-white text-[var(--sidebar)] shadow-md font-bold"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Boxes size={19} />
                  <span className="mt-0.5 scale-90">Stock</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center pb-1">
              <span className="text-[9px] uppercase tracking-wider text-white/50 font-bold">ABPS</span>
            </div>
          </div>
        )}

        {/* Sub Sidebar (Secondary Sidebar containing specific Module Menu) */}
        <div
          className="flex h-full flex-1 flex-col overflow-hidden"
          style={{
            background: org.sidebar_color,
            width: subWidth,
          }}
        >
          {/* Header Sub Sidebar */}
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
              {showLabels && (
                <div className="mt-1 flex items-center gap-1.5 truncate text-[10px] font-medium text-white/80">
                  <span className="rounded bg-white/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                    {activeModule === "stock" ? "Modul Stock" : "Modul HR"}
                  </span>
                </div>
              )}
            </div>

            {mobile ? (
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80"
                onClick={() => setDrawer(false)}
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            ) : (
              <button
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:bg-white/10"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Bentangkan menu" : "Ciutkan menu"}
              >
                <ChevronLeft size={18} className={collapsed ? "rotate-180" : ""} />
              </button>
            )}
          </div>

          {/* Module Switcher on Mobile Drawer */}
          {mobile && isSuperadmin && (
            <div className="flex border-b border-white/15 p-2 gap-2 bg-black/10">
              <button
                type="button"
                onClick={() => setActiveModule("hr")}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg ${
                  activeModule === "hr" ? "bg-white text-[var(--sidebar)]" : "text-white/70"
                }`}
              >
                Modul HR
              </button>
              <button
                type="button"
                onClick={() => setActiveModule("stock")}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg ${
                  activeModule === "stock" ? "bg-white text-[var(--sidebar)]" : "text-white/70"
                }`}
              >
                Modul Stock
              </button>
            </div>
          )}

          {/* Navigation Items List */}
          <nav className="min-h-0 flex-1 overflow-y-auto py-1" aria-label="Menu navigasi">
            {currentNavGroups.map((g) => (
              <div key={g.group}>
                {showLabels && (
                  <div className="px-4 pt-3 pb-1 text-[10px] font-bold tracking-widest uppercase opacity-45">
                    {g.group}
                  </div>
                )}
                {g.items.map((it) => {
                  const Icon = ICONS[it.href] ?? LayoutDashboard;
                  const on = active(it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      title={it.label}
                      className="flex min-h-10 items-center gap-2.5 py-2 pr-3 pl-3.5 text-[13px] hover:bg-white/10 transition-colors"
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

          {/* Footer User Info */}
          <div className="shrink-0 border-t border-white/15 px-3 py-3">
            {showLabels && (
              <div className="mb-2 min-w-0 px-1">
                <div className="truncate text-[13px] font-semibold">{userNama}</div>
                <div className="truncate text-[11px] text-white/70">{userEmail}</div>
              </div>
            )}
            <LogoutButton tone="sidebar" showLabel={showLabels} />
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
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
            <div className="flex items-center gap-2 truncate text-[13px] font-semibold text-[#333] md:text-[14px]">
              <span>{org.nama}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                {activeModule === "stock" ? "Modul Stok & HPP" : "Modul HR & Payroll"}
              </span>
            </div>
            <div className="hidden truncate text-[11px] text-[#888] sm:block">{org.tagline}</div>
          </div>
          <LogoutButton className="md:hidden" />
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
