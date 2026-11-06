export const NAV = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/worklist", label: "Daftar kerja" },
    ],
  },
  {
    group: "CRM",
    items: [
      { href: "/donors", label: "Donatur" },
      { href: "/programs", label: "Program" },
      { href: "/campaigns", label: "Campaign" },
      { href: "/transactions", label: "Transaksi" },
      { href: "/segments", label: "Segmen" },
    ],
  },
  {
    group: "Blasting",
    items: [
      { href: "/blast-batches", label: "Batch blast" },
      { href: "/prospect-notes", label: "Catatan prospek" },
      { href: "/vendor-profiles", label: "Vendor" },
    ],
  },
  {
    group: "Konfigurasi",
    items: [
      { href: "/field-definitions", label: "Field dinamis" },
      { href: "/tags", label: "Label donatur" },
      { href: "/users", label: "Pengguna" },
      { href: "/data-imports", label: "Impor data" },
      { href: "/extensions", label: "Ekstensi" },
      { href: "/app-config", label: "Pengaturan lembaga" },
    ],
  },
] as const;

export const DEFAULT_ORG = {
  nama: "Relawan Nusantara",
  namaSingkat: "RN",
  tagline: "CRM Superadmin",
  logoUrl:
    "https://erp.relawannusantara.org/web/image/cnt_cf.res_company/18/logo_perusahaan_putih/18.png?w=100&h=42&q=100&upscale=true&auto=compress,format",
  faviconUrl: null as string | null,
  primaryColor: "#01665a",
  sidebarColor: "#01665a",
  accentColor: "#2e8b7a",
};

export const LOGO_URL = DEFAULT_ORG.logoUrl;
