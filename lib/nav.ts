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
const ALL: Role[] = ["superadmin", "superordinat", "subordinat"];

export const NAV_HR: NavGroup[] = [
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

export const NAV_STOCK: NavGroup[] = [
  {
    group: "Pembelian & Kas",
    items: [
      { href: "/stock/purchase-requests", label: "Permintaan Belanja", roles: SA },
      { href: "/stock/purchase-orders", label: "Pesanan Beli (PO)", roles: SA },
      { href: "/stock/goods-receipts", label: "Penerimaan Barang (GRN)", roles: SA },
      { href: "/stock/vendor-bills", label: "Hutang Vendor", roles: SA },
      { href: "/stock/vendor-payments", label: "Pembayaran Vendor", roles: SA },
      { href: "/stock/cash-funds", label: "Kas Dapur & Operasional", roles: SA },
    ],
  },
  {
    group: "Produksi & Pengolahan",
    items: [
      { href: "/stock/production-orders", label: "Perintah Produksi (Ungkep)", roles: SA },
      { href: "/stock/boms", label: "Resep & Komposisi (BOM)", roles: SA },
    ],
  },
  {
    group: "Penjualan & Distribusi",
    items: [
      { href: "/stock/sales-orders", label: "Order Penjualan (SO)", roles: SA },
      { href: "/stock/shipments", label: "Pengiriman (Surat Jalan)", roles: SA },
      { href: "/stock/sales-invoices", label: "Faktur & Piutang", roles: SA },
      { href: "/stock/price-lists", label: "Daftar Harga & Margin", roles: SA },
    ],
  },
  {
    group: "Inventori & Opname",
    items: [
      { href: "/stock/balances", label: "Saldo Stok & Nilai", roles: SA },
      { href: "/stock/moves", label: "Kartu Stok (Mutasi)", roles: SA },
      { href: "/stock/counts", label: "Stock Opname", roles: SA },
      { href: "/stock/reversals", label: "Koreksi / Pembalik", roles: SA },
    ],
  },
  {
    group: "Master & Mitra Stok",
    items: [
      { href: "/stock/items", label: "Katalog Barang", roles: SA },
      { href: "/stock/bins", label: "Bin Gudang & Freezer", roles: SA },
      { href: "/stock/parties", label: "Vendor, Outlet & Katering", roles: SA },
      { href: "/stock/categories", label: "Kategori Barang", roles: SA },
      { href: "/stock/uoms", label: "Satuan Ukur (UoM)", roles: SA },
    ],
  },
  {
    group: "Laporan Stok & HPP",
    items: [
      { href: "/stock/reports", label: "Laporan Terpadu HPP & Laba", roles: SA },
    ],
  },
];

export const NAV = NAV_HR;

export function navForRole(role: Role, module: "hr" | "stock" = "hr"): NavGroup[] {
  const target = module === "stock" ? NAV_STOCK : NAV_HR;
  return target
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => it.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0);
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
