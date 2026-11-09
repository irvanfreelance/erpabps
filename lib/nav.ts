import type { Role } from "@/types/auth";

export type NavItem = {
  href: string;
  label: string;
  roles: Role[];
};

export type NavGroup = {
  group: string;
  items: NavItem[];
};

const SA: Role[] = ["superadmin"];
const SA_SO: Role[] = ["superadmin", "superordinat"];
const ALL: Role[] = ["superadmin", "superordinat", "subordinat"];

export const NAV: NavGroup[] = [
  {
    group: "Aktivitas Utama",
    items: [
      { href: "/employees", label: "Karyawan", roles: ALL },
      { href: "/attendances/clock", label: "Clock In / Pulang", roles: ALL },
      { href: "/attendances", label: "Rekap Kehadiran", roles: ALL },
      { href: "/schedules", label: "Kalender Shift", roles: ALL },
      { href: "/payslips", label: "List Gaji", roles: ALL },
    ],
  },
  {
    group: "Pengajuan",
    items: [
      { href: "/overtimes", label: "Pengajuan Lembur", roles: ALL },
      { href: "/leaves", label: "Pengajuan Cuti / Izin / Off", roles: ALL },
      { href: "/shift-swaps", label: "Pengajuan Tukar Shift", roles: ALL },
      { href: "/cash-advances", label: "Pengajuan Kasbon", roles: ALL },
    ],
  },
  {
    group: "Manajemen HR (Admin)",
    items: [
      { href: "/payroll-runs", label: "Run Payroll", roles: SA },
      { href: "/bonus/monthly", label: "Bonus Bulanan", roles: SA },
      { href: "/cash-advances/screening", label: "Screening Kasbon", roles: SA },
      { href: "/attendances/backdate", label: "Entry Presensi Backdate", roles: SA },
      { href: "/shift-templates", label: "Template Shift", roles: SA },
      { href: "/reports/attendance", label: "Laporan Kehadiran", roles: SA },
      { href: "/reports/payroll", label: "Laporan Payroll", roles: SA },
    ],
  },
  {
    group: "Master & Konfigurasi (Admin)",
    items: [
      { href: "/master/locations", label: "Lokasi", roles: SA },
      { href: "/master/positions", label: "Jabatan", roles: SA },
      { href: "/master/ranks", label: "Pangkat", roles: SA },
      { href: "/master/employee-types", label: "Jenis Karyawan", roles: SA },
      { href: "/master/pay-groups", label: "Kelompok Gaji", roles: SA },
      { href: "/master/salary-components", label: "Komponen Gaji", roles: SA },
      { href: "/master/holidays", label: "Hari Libur", roles: SA },
      { href: "/contract-stages", label: "Katalog Kontrak", roles: SA },
      { href: "/contracts", label: "Kontrak Karyawan", roles: SA },
      { href: "/settings", label: "Profil Lembaga", roles: SA },
      { href: "/settings/rules", label: "Aturan & Kebijakan", roles: SA },
      { href: "/users", label: "Pengguna & Akun", roles: SA },
    ],
  },
];

export function navForRole(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((it) => it.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export const DEFAULT_ORG = {
  nama: "Ayam Bakar Pucuk Singkong",
  namaSingkat: "ABPS",
  tagline: "Absensi dan payroll IPA",
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  primaryColor: "#01665a",
  sidebarColor: "#01665a",
  accentColor: "#2e8b7a",
};

export const LOGO_URL = DEFAULT_ORG.logoUrl;
