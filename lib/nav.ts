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
    group: "Overview",
    items: [
      { href: "/dashboard", label: "Dasbor", roles: ALL },
      { href: "/employees", label: "Karyawan", roles: ALL },
    ],
  },
  {
    group: "Presensi",
    items: [
      { href: "/attendances/clock", label: "Clock-in", roles: ALL },
      { href: "/attendances", label: "Rekap", roles: ALL },
      { href: "/attendances/backdate", label: "Backdate", roles: SA },
    ],
  },
  {
    group: "Jadwal",
    items: [
      { href: "/schedules", label: "Kalender", roles: ALL },
      { href: "/shift-templates", label: "Template", roles: SA_SO },
      { href: "/shift-swaps", label: "Tukar shift", roles: ALL },
    ],
  },
  {
    group: "Payroll",
    items: [
      { href: "/payroll-runs", label: "Run", roles: SA_SO },
      { href: "/payslips", label: "Slip", roles: ALL },
    ],
  },
  {
    group: "Kasbon",
    items: [
      { href: "/cash-advances", label: "Pengajuan", roles: ALL },
      { href: "/cash-advances/screening", label: "Screening", roles: SA },
    ],
  },
  {
    group: "Bonus",
    items: [
      { href: "/bonus/outlet-revenues", label: "Omset outlet", roles: SA },
      { href: "/bonus/monthly", label: "Bonus bulanan", roles: ALL },
    ],
  },
  {
    group: "Kontrak",
    items: [
      { href: "/contract-stages", label: "Katalog tahap", roles: SA_SO },
      { href: "/contracts", label: "Kontrak orang", roles: ALL },
    ],
  },
  {
    group: "Laporan",
    items: [
      { href: "/reports/attendance", label: "Kehadiran", roles: ALL },
      { href: "/reports/payroll", label: "Payroll", roles: ALL },
    ],
  },
  {
    group: "Master",
    items: [
      { href: "/master/locations", label: "Lokasi", roles: SA_SO },
      { href: "/master/positions", label: "Jabatan", roles: SA_SO },
      { href: "/master/ranks", label: "Pangkat", roles: SA_SO },
      { href: "/master/pay-groups", label: "Kelompok gaji", roles: SA_SO },
      { href: "/master/salary-components", label: "Komponen", roles: SA_SO },
      { href: "/master/holidays", label: "Hari libur", roles: SA_SO },
    ],
  },
  {
    group: "Pengaturan",
    items: [
      { href: "/settings", label: "Lembaga", roles: SA },
      { href: "/settings/rules", label: "Aturan", roles: SA },
      { href: "/users", label: "Pengguna", roles: SA },
    ],
  },
  {
    group: "Persetujuan",
    items: [
      { href: "/approvals", label: "Kotak", roles: ALL },
      { href: "/approvals/policies", label: "Kebijakan", roles: SA },
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
