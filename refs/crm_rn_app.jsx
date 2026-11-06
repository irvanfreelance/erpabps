import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import {
  LayoutDashboard, ClipboardList, Users, Bookmark, Megaphone,
  Wallet, Target, Send, FileText, Plug, Settings, KeyRound,
  FolderUp, Puzzle, Wrench, AlertTriangle, ArrowLeft, Plus,
  Search, Download, Activity, TrendingUp, UserCheck, CircleDot,
  Eye, Shield, X, Filter, Check, ArrowRight, RefreshCw, Trash2,
  Shuffle, Menu, ChevronLeft
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   SEED DATA
   ═══════════════════════════════════════════════════════════════ */

const PROGRAMS = [
  { id: 1, slug: "ramadan", nama: "Ramadan", kategori: "seasonal", is_active: true },
  { id: 2, slug: "qurban", nama: "Qurban", kategori: "seasonal", is_active: true },
  { id: 3, slug: "zakat_fitrah", nama: "Zakat Fitrah", kategori: "zakat", is_active: true },
  { id: 4, slug: "zakat_mal", nama: "Zakat Mal", kategori: "zakat", is_active: true },
  { id: 5, slug: "wakaf", nama: "Wakaf", kategori: "wakaf", is_active: true },
  { id: 6, slug: "anak_yatim", nama: "Anak Yatim", kategori: "reguler", is_active: true },
  { id: 7, slug: "bencana_alam", nama: "Bencana Alam", kategori: "emergency", is_active: true },
  { id: 8, slug: "beasiswa", nama: "Beasiswa", kategori: "reguler", is_active: true },
  { id: 9, slug: "infaq", nama: "Infaq & Sedekah", kategori: "reguler", is_active: true },
  { id: 10, slug: "muharram", nama: "Muharram", kategori: "seasonal", is_active: true },
];

const CAMPAIGNS = [
  { id: 1, slug: "ramadan_2023", nama: "Ramadan 2023", program_id: 1, tipe: "seasonal", tgl_mulai: "2023-03-01", is_active: true },
  { id: 2, slug: "qurban_2023", nama: "Qurban 2023", program_id: 2, tipe: "seasonal", tgl_mulai: "2023-05-01", is_active: true },
  { id: 3, slug: "ramadan_2024", nama: "Ramadan 2024", program_id: 1, tipe: "seasonal", tgl_mulai: "2024-03-01", is_active: true },
  { id: 4, slug: "qurban_2024", nama: "Qurban 2024", program_id: 2, tipe: "seasonal", tgl_mulai: "2024-05-01", is_active: true },
  { id: 9, slug: "reengagement_q4", nama: "Re-engagement At Risk Q4", program_id: null, tipe: "reengagement", tgl_mulai: "2025-10-01", is_active: true },
  { id: 10, slug: "ramadan_2025", nama: "Ramadan 2025", program_id: 1, tipe: "seasonal", tgl_mulai: "2025-02-28", is_active: true },
  { id: 11, slug: "qurban_2025_eb", nama: "Qurban 2025 Early Bird", program_id: 2, tipe: "seasonal", tgl_mulai: "2025-04-01", is_active: true },
  { id: 15, slug: "qurban_2026", nama: "Qurban 2026", program_id: 2, tipe: "seasonal", tgl_mulai: "2026-04-01", is_active: true },
  { id: 16, slug: "onboarding_new", nama: "Onboarding Baru", program_id: null, tipe: "onboarding", tgl_mulai: null, is_active: true },
];

const USERS_DATA = [
  { id: 1, nama: "Admin Sistem", email: "dev@cnt.id", role: "admin", is_active: true },
  { id: 2, nama: "Regi Fajar R.", email: "regi@cnt.id", role: "supervisor", is_active: true },
  { id: 3, nama: "Rizky Bachtiar", email: "rizky@cnt.id", role: "supervisor", is_active: true },
  { id: 4, nama: "Sari Rahmawati", email: "sari@rn.org", role: "data_analyst", is_active: true },
  { id: 5, nama: "Dian Kusuma", email: "dian@rn.org", role: "data_analyst", is_active: true },
  { id: 6, nama: "Budi Santoso", email: "budi@rn.org", role: "tim_blast", is_active: true },
  { id: 7, nama: "Rina Dewi", email: "rina@rn.org", role: "tim_blast", is_active: true },
  { id: 8, nama: "Ahmad Fauzi", email: "ahmad@rn.org", role: "tim_blast", is_active: true },
  { id: 9, nama: "Lestari Wulandari", email: "lestari@rn.org", role: "tim_blast", is_active: true },
  { id: 10, nama: "Hendra Gunawan", email: "hendra@rn.org", role: "tim_blast", is_active: true },
  { id: 11, nama: "Fitriani Noor", email: "fitri@rn.org", role: "tim_blast", is_active: true },
  { id: 12, nama: "Viewer Only", email: "viewer@rn.org", role: "read_only", is_active: true },
];

const PIC_USERS = USERS_DATA.filter(u => ["tim_blast", "supervisor"].includes(u.role));

const INIT_DONORS = [
  { id: 1, no_hp: "6281234567890", nama: "Budi Rahmat Santoso", email: "budi.rahmat@email.com", status: "aktif", segmen: "champions", skor_r: 5, skor_f: 5, skor_m: 5, tags: ["prioritas", "loyal"], assigned_to: 6, follow_up: "in_progress", due: "2026-04-20", last_at: "2025-03-15", last_nom: 500000, last_prog_id: 1, total: 4250000, count: 12, progs: [1, 2, 6, 3] },
  { id: 2, no_hp: "6285678901234", nama: "Dewi Anggraeni Putri", email: "dewi.anggraeni@gmail.com", status: "aktif", segmen: "champions", skor_r: 5, skor_f: 5, skor_m: 5, tags: ["prioritas", "qurban_rutin"], assigned_to: 7, follow_up: "waiting_callback", due: "2026-04-18", last_at: "2025-03-10", last_nom: 1000000, last_prog_id: 1, total: 8750000, count: 18, progs: [1, 2, 4] },
  { id: 3, no_hp: "6287890123456", nama: "Hendra Wijaksono", email: "hendra.w@company.co.id", status: "aktif", segmen: "champions", skor_r: 4, skor_f: 5, skor_m: 5, tags: ["high_value", "wakaf"], assigned_to: 8, follow_up: null, due: null, last_at: "2025-06-01", last_nom: 2000000, last_prog_id: 5, total: 15200000, count: 24, progs: [1, 2, 5] },
  { id: 4, no_hp: "6282345678901", nama: "Siti Nurhaliza Rahmah", email: "siti.nurhaliza@yahoo.com", status: "aktif", segmen: "loyal", skor_r: 4, skor_f: 4, skor_m: 4, tags: ["loyal", "ramadan_rutin"], assigned_to: 6, follow_up: "in_progress", due: "2026-04-25", last_at: "2025-03-20", last_nom: 300000, last_prog_id: 1, total: 2800000, count: 10, progs: [1, 2] },
  { id: 5, no_hp: "6289012345678", nama: "Rizal Fahmi Harahap", email: "rizal.fahmi@gmail.com", status: "aktif", segmen: "loyal", skor_r: 4, skor_f: 4, skor_m: 3, tags: ["loyal"], assigned_to: 7, follow_up: null, due: null, last_at: "2025-04-05", last_nom: 750000, last_prog_id: 4, total: 5100000, count: 9, progs: [1, 2, 4] },
  { id: 6, no_hp: "6281122334455", nama: "Fatimah Zahra Nasution", email: "fatimah@email.com", status: "aktif", segmen: "loyal", skor_r: 5, skor_f: 4, skor_m: 3, tags: ["loyal", "ibu_rt"], assigned_to: 8, follow_up: null, due: null, last_at: "2025-05-12", last_nom: 500000, last_prog_id: 6, total: 3600000, count: 11, progs: [1, 6] },
  { id: 7, no_hp: "6285544332211", nama: "Agus Setiawan Prabowo", email: "agus@email.com", status: "aktif", segmen: "potential", skor_r: 4, skor_f: 3, skor_m: 3, tags: [], assigned_to: 9, follow_up: null, due: null, last_at: "2025-04-20", last_nom: 200000, last_prog_id: 1, total: 1200000, count: 5, progs: [1] },
  { id: 8, no_hp: "6288776655443", nama: "Nurul Hidayah Wahab", email: "nurul@gmail.com", status: "aktif", segmen: "potential", skor_r: 3, skor_f: 3, skor_m: 2, tags: [], assigned_to: 10, follow_up: null, due: null, last_at: "2025-03-28", last_nom: 150000, last_prog_id: 7, total: 850000, count: 4, progs: [7] },
  { id: 9, no_hp: "6283321098765", nama: "Teguh Santoso Haryono", email: "teguh@email.com", status: "aktif", segmen: "potential", skor_r: 3, skor_f: 2, skor_m: 3, tags: [], assigned_to: 11, follow_up: null, due: null, last_at: "2025-02-14", last_nom: 250000, last_prog_id: 2, total: 950000, count: 3, progs: [2] },
  { id: 10, no_hp: "6286655443322", nama: "Indah Permatasari", email: "indah@gmail.com", status: "aktif", segmen: "at_risk", skor_r: 2, skor_f: 4, skor_m: 4, tags: ["perlu_reengagement"], assigned_to: 6, follow_up: "in_progress", due: "2026-04-15", last_at: "2024-10-20", last_nom: 500000, last_prog_id: 2, total: 3800000, count: 14, progs: [1, 2] },
  { id: 11, no_hp: "6289988776655", nama: "Bambang Eko Prasetyo", email: "bambang@yahoo.com", status: "aktif", segmen: "at_risk", skor_r: 2, skor_f: 3, skor_m: 4, tags: ["perlu_reengagement", "high_value"], assigned_to: 7, follow_up: "waiting_callback", due: "2026-04-17", last_at: "2024-09-15", last_nom: 750000, last_prog_id: 5, total: 6200000, count: 15, progs: [1, 2, 5] },
  { id: 12, no_hp: "6281098765432", nama: "Yanti Sulistyowati", email: "yanti@email.com", status: "aktif", segmen: "at_risk", skor_r: 1, skor_f: 5, skor_m: 5, tags: ["perlu_reengagement", "champion_lama"], assigned_to: 8, follow_up: "in_progress", due: "2026-04-12", last_at: "2024-06-20", last_nom: 1000000, last_prog_id: 2, total: 12400000, count: 22, progs: [1, 2] },
  { id: 13, no_hp: "6282211009988", nama: "Andi Firmansyah", email: "andi@email.com", status: "aktif", segmen: "new", skor_r: 5, skor_f: 1, skor_m: 2, tags: ["new_donor"], assigned_to: 9, follow_up: null, due: null, last_at: "2026-03-01", last_nom: 100000, last_prog_id: 7, total: 200000, count: 2, progs: [7, 1] },
  { id: 14, no_hp: "6285533221100", nama: "Lia Septiani K.", email: "lia@gmail.com", status: "aktif", segmen: "new", skor_r: 5, skor_f: 1, skor_m: 1, tags: ["new_donor"], assigned_to: 10, follow_up: null, due: null, last_at: "2026-01-25", last_nom: 50000, last_prog_id: 8, total: 50000, count: 1, progs: [8] },
  { id: 15, no_hp: "6287766554433", nama: "Rendra Pratama", email: "rendra@email.com", status: "aktif", segmen: "new", skor_r: 5, skor_f: 1, skor_m: 2, tags: ["new_donor"], assigned_to: 11, follow_up: null, due: null, last_at: "2026-03-15", last_nom: 200000, last_prog_id: 5, total: 400000, count: 2, progs: [5] },
  { id: 16, no_hp: "6283344556677", nama: "Desi Ratnasari", email: "desi@yahoo.com", status: "aktif", segmen: "one_time", skor_r: 3, skor_f: 1, skor_m: 2, tags: [], assigned_to: 6, follow_up: null, due: null, last_at: "2024-03-20", last_nom: 100000, last_prog_id: 1, total: 100000, count: 1, progs: [1] },
  { id: 17, no_hp: "6286677889900", nama: "Fajar Nugroho W.", email: "fajar@email.com", status: "aktif", segmen: "one_time", skor_r: 2, skor_f: 1, skor_m: 1, tags: [], assigned_to: 7, follow_up: null, due: null, last_at: "2024-07-10", last_nom: 75000, last_prog_id: 2, total: 75000, count: 1, progs: [2] },
  { id: 18, no_hp: "6281234500000", nama: "Gunawan Saputra", email: "gunawan@email.com", status: "aktif", segmen: "lost", skor_r: 1, skor_f: 1, skor_m: 1, tags: [], assigned_to: null, follow_up: null, due: null, last_at: "2022-01-10", last_nom: 200000, last_prog_id: 1, total: 1500000, count: 7, progs: [1] },
  { id: 19, no_hp: "6285599887766", nama: "Wulandari Prasetyo", email: null, status: "aktif", segmen: "lost", skor_r: 1, skor_f: 2, skor_m: 1, tags: [], assigned_to: null, follow_up: null, due: null, last_at: "2022-06-05", last_nom: 150000, last_prog_id: 2, total: 600000, count: 4, progs: [2] },
  { id: 20, no_hp: "6287788990011", nama: "Riko Maulana", email: "riko@gmail.com", status: "mati", segmen: null, skor_r: null, skor_f: null, skor_m: null, tags: [], assigned_to: null, follow_up: null, due: null, last_at: null, last_nom: null, last_prog_id: null, total: 500000, count: 3, progs: [] },
  { id: 21, no_hp: "6281199887766", nama: "Sri Lestari", email: "sri@email.com", status: "diblokir", segmen: null, skor_r: null, skor_f: null, skor_m: null, tags: [], assigned_to: null, follow_up: null, due: null, last_at: "2024-01-15", last_nom: 300000, last_prog_id: 1, total: 1200000, count: 4, progs: [1] },
  { id: 22, no_hp: "6289900112233", nama: "Pak Hartono", email: "hartono@email.com", status: "opt_out", segmen: null, skor_r: null, skor_f: null, skor_m: null, tags: [], assigned_to: null, follow_up: null, due: null, last_at: "2023-12-25", last_nom: 500000, last_prog_id: 3, total: 3000000, count: 8, progs: [1, 3] },
  { id: 23, no_hp: "6284455667788", nama: "Kurniawan Effendi", email: "kurniawan@email.com", status: "aktif", segmen: "loyal", skor_r: 4, skor_f: 4, skor_m: 4, tags: ["merged_3_ids"], assigned_to: 8, follow_up: null, due: null, last_at: "2025-05-20", last_nom: 400000, last_prog_id: 1, total: 4800000, count: 12, progs: [1, 2] },
  { id: 24, no_hp: "6281357924680", nama: "Maya Sari Dewi", email: "maya@email.com", status: "aktif", segmen: "at_risk", skor_r: 2, skor_f: 3, skor_m: 3, tags: ["overdue_followup"], assigned_to: 9, follow_up: "in_progress", due: "2026-03-01", last_at: "2024-12-10", last_nom: 250000, last_prog_id: 6, total: 1750000, count: 7, progs: [6, 1, 2] },
  { id: 25, no_hp: "6289753186420", nama: "Doni Hermawan", email: "doni@gmail.com", status: "aktif", segmen: "potential", skor_r: 3, skor_f: 2, skor_m: 2, tags: [], assigned_to: null, follow_up: null, due: null, last_at: "2025-01-15", last_nom: 100000, last_prog_id: 8, total: 300000, count: 3, progs: [8] },
];

const TRANSACTIONS = [
  { id: 1, donor_id: 1, program_id: 1, campaign_id: 1, tgl: "2023-03-25", nominal: 300000, status: "paid", sumber: "zains" },
  { id: 3, donor_id: 1, program_id: 1, campaign_id: 3, tgl: "2024-03-18", nominal: 400000, status: "paid", sumber: "zains" },
  { id: 7, donor_id: 1, program_id: 1, campaign_id: 10, tgl: "2025-03-15", nominal: 500000, status: "paid", sumber: "zains" },
  { id: 15, donor_id: 2, program_id: 1, campaign_id: 10, tgl: "2025-03-10", nominal: 1000000, status: "paid", sumber: "cf" },
  { id: 21, donor_id: 3, program_id: 5, campaign_id: null, tgl: "2025-06-01", nominal: 2000000, status: "paid", sumber: "zains" },
  { id: 25, donor_id: 4, program_id: 1, campaign_id: 10, tgl: "2025-03-20", nominal: 300000, status: "paid", sumber: "cf" },
  { id: 34, donor_id: 10, program_id: 2, campaign_id: 4, tgl: "2024-10-20", nominal: 500000, status: "paid", sumber: "zains" },
  { id: 40, donor_id: 12, program_id: 2, campaign_id: 4, tgl: "2024-06-20", nominal: 1000000, status: "paid", sumber: "zains" },
  { id: 50, donor_id: 7, program_id: 2, campaign_id: 15, tgl: "2026-04-01", nominal: 300000, status: "checkout", sumber: "cf" },
  { id: 53, donor_id: 13, program_id: 1, campaign_id: null, tgl: "2026-04-10", nominal: 100000, status: "paid", sumber: "cf" },
];

const BLAST_BATCHES = [
  { id: 1, campaign_id: 10, vendor_id: 1, tgl: "2025-03-01", target: 9800, terkirim: 8920, gagal: 880, dibaca: 3120, respon: 450, closing: 72, status: "done", oleh: 4 },
  { id: 3, campaign_id: 11, vendor_id: 2, tgl: "2025-05-01", target: 12000, terkirim: 10800, gagal: 1200, dibaca: 3800, respon: 620, closing: 88, status: "done", oleh: 5 },
  { id: 4, campaign_id: 9, vendor_id: 1, tgl: "2025-10-10", target: 5000, terkirim: 4350, gagal: 650, dibaca: 1100, respon: 180, closing: 22, status: "done", oleh: 4 },
  { id: 6, campaign_id: 15, vendor_id: 1, tgl: "2026-04-01", target: 1000, terkirim: 900, gagal: 100, dibaca: 280, respon: 45, closing: 8, status: "done", oleh: 4 },
];

const PROSPECT_NOTES = [
  { id: 1, donor_id: 1, user_id: 6, campaign_id: 10, tgl: "2025-03-02", channel: "wappin", respon: "closing", catatan: "Transfer langsung.", source: "web_app" },
  { id: 3, donor_id: 1, user_id: 6, campaign_id: 15, tgl: "2026-04-02", channel: "web_whatsapp_ext", respon: "closing", catatan: "Transfer 500rb qurban.", source: "chrome_extension" },
  { id: 6, donor_id: 10, user_id: 6, campaign_id: 10, tgl: "2025-03-05", channel: "wappin", respon: "hanya_read", catatan: "Dibaca tidak dibalas.", source: "web_app" },
  { id: 13, donor_id: 24, user_id: 9, campaign_id: 15, tgl: "2026-02-15", channel: "wappin", respon: "merespon", catatan: "Minta callback. OVERDUE.", source: "web_app" },
  { id: 15, donor_id: 23, user_id: 8, campaign_id: 10, tgl: "2025-04-10", channel: "wappin", respon: "closing", catatan: "400rb. 3 ID merged.", source: "web_app" },
];

const SAVED_SEGMENTS_INIT = [
  { id: 1, nama: "Qurban 2024 — Belum Qurban 2025", count: 847, refresh: "weekly", is_public: true, oleh: 4 },
  { id: 2, nama: "Ramadan 2025 — Belum Donasi", count: 1243, refresh: "weekly", is_public: true, oleh: 4 },
  { id: 3, nama: "At Risk High Value", count: 156, refresh: "manual", is_public: true, oleh: 2 },
  { id: 4, nama: "Aktif Belum Di-assign", count: 4821, refresh: "daily", is_public: true, oleh: 2 },
  { id: 5, nama: "Follow-up Overdue", count: 23, refresh: "daily", is_public: false, oleh: 2 },
];

const VENDOR_PROFILES = [{ id: 1, nama: "Wappin v2", is_default: true }, { id: 2, nama: "Mekari Qontak", is_default: false }, { id: 3, nama: "Cekat AI", is_default: false }];
const FIELD_DEFS = [{ id: 1, slug: "wilayah_donatur", label: "Wilayah", tipe: "dropdown", is_searchable: true, is_active: true }, { id: 2, slug: "preferensi_program", label: "Preferensi Program", tipe: "multiselect", is_searchable: true, is_active: true }, { id: 3, slug: "profesi", label: "Profesi", tipe: "dropdown", is_searchable: true, is_active: true }, { id: 4, slug: "donatur_tetap", label: "Donatur Tetap", tipe: "boolean", is_searchable: true, is_active: true }, { id: 5, slug: "channel_akuisisi", label: "Channel Akuisisi", tipe: "dropdown", is_searchable: true, is_active: true }];
const DATA_IMPORTS = [{ id: 1, type: "donors", file: "donatur_zains.csv", total: 15420, new_r: 1243, merge: 312, skip: 18, err: 3, status: "done", oleh: 4 }, { id: 2, type: "transactions", file: "transaksi_3thn.csv", total: 48760, new_r: 48760, merge: 0, skip: 12, err: 0, status: "done", oleh: 4 }];
const EXT_CONFIGS = [{ ext_type: "zains_sync", is_active: false, status: "disabled", desc: "Sinkronisasi ZAINS." }, { ext_type: "cf_sync", is_active: false, status: "disabled", desc: "Sinkronisasi CF/Donol." }, { ext_type: "whatsapp_extension", is_active: true, status: "active", desc: "Chrome Extension web.whatsapp.com." }, { ext_type: "vendor_blast_api", is_active: false, status: "disabled", desc: "API vendor blast." }];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

const fmtRp = (n) => (n == null ? "—" : "Rp " + Number(n).toLocaleString("id-ID"));
const pName = (id) => PROGRAMS.find((p) => p.id === id)?.nama || "—";
const uName = (id) => USERS_DATA.find((u) => u.id === id)?.nama || "—";
const cName = (id) => CAMPAIGNS.find((c) => c.id === id)?.nama || "—";
const vName = (id) => VENDOR_PROFILES.find((v) => v.id === id)?.nama || "—";

const SC = { champions: "#01665a", loyal: "#2e8b7a", potential: "#5cb8a8", at_risk: "#e74c3c", lost: "#95a5a6", new: "#3498db", one_time: "#f39c12" };
const STC = { aktif: "#01665a", mati: "#e74c3c", diblokir: "#c0392b", opt_out: "#8e44ad" };
const P = "#01665a";

const Badge = ({ children, color = P }) => (
  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: color + "20", color, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const RfmDisplay = ({ r, f, m }) => {
  if (r == null) return <span style={{ color: "#aaa" }}>—</span>;
  return <span style={{ fontFamily: "monospace", fontSize: 13 }}>R{r} F{f} M{m}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   RESPONSIVE HOOK
   ═══════════════════════════════════════════════════════════════ */

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

/* ═══════════════════════════════════════════════════════════════
   REUSABLE TABLE
   ═══════════════════════════════════════════════════════════════ */

function DataTable({ columns, data, onRow, selectable, checked, onCheck }) {
  const allChecked = checked && data.length > 0 && checked.size === data.length;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
        <thead>
          <tr>
            {selectable && (
              <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#555", borderBottom: "2px solid #e8e8e8", width: 36 }}>
                <input type="checkbox" checked={allChecked} onChange={(e) => { const s = new Set(); if (e.target.checked) data.forEach((d) => s.add(d.id)); onCheck(s); }} />
              </th>
            )}
            {columns.map((c, i) => (
              <th key={i} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#555", borderBottom: "2px solid #e8e8e8", whiteSpace: "nowrap" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ cursor: onRow ? "pointer" : "default", background: checked?.has(row.id) ? "#01665a08" : "transparent" }} onClick={() => onRow?.(row)}>
              {selectable && (
                <td style={{ padding: "7px 10px", borderBottom: "1px solid #f0f0f0" }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={checked?.has(row.id) || false} onChange={() => { const s = new Set(checked); if (s.has(row.id)) s.delete(row.id); else s.add(row.id); onCheck(s); }} />
                </td>
              )}
              {columns.map((c, j) => (
                <td key={j} style={{ padding: "7px 10px", borderBottom: "1px solid #f0f0f0", fontSize: 13, whiteSpace: "nowrap" }}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#999" }}>Tidak ada data cocok</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   QUERY BUILDER
   ═══════════════════════════════════════════════════════════════ */

const COND_TYPES = [
  { value: "program_has", label: "Pernah donasi program" },
  { value: "program_not", label: "Belum pernah donasi program" },
  { value: "last_donation_after", label: "Donasi terakhir setelah" },
  { value: "last_donation_before", label: "Donasi terakhir sebelum" },
  { value: "total_gte", label: "Total donasi >=" },
  { value: "total_lte", label: "Total donasi <=" },
  { value: "count_gte", label: "Jumlah transaksi >=" },
  { value: "segmen", label: "Segmen RFM" },
  { value: "status", label: "Status kontak" },
  { value: "assigned_to", label: "PIC / Assigned to" },
  { value: "unassigned", label: "Belum di-assign" },
  { value: "follow_up", label: "Status follow-up" },
  { value: "overdue", label: "Follow-up overdue" },
  { value: "tag_has", label: "Punya tag" },
];

function applyConditions(donors, conditions) {
  if (!conditions.length) return donors;
  return donors.filter((d) =>
    conditions.every((c) => {
      switch (c.type) {
        case "program_has": return c.value && d.progs.includes(+c.value);
        case "program_not": return c.value && !d.progs.includes(+c.value);
        case "last_donation_after": return c.value && d.last_at && d.last_at >= c.value;
        case "last_donation_before": return c.value && d.last_at && d.last_at <= c.value;
        case "total_gte": return c.value && d.total >= +c.value;
        case "total_lte": return c.value && d.total <= +c.value;
        case "count_gte": return c.value && d.count >= +c.value;
        case "segmen": return c.value && d.segmen === c.value;
        case "status": return c.value && d.status === c.value;
        case "assigned_to": return c.value && d.assigned_to === +c.value;
        case "unassigned": return d.assigned_to == null;
        case "follow_up": return c.value && d.follow_up === c.value;
        case "overdue": return d.follow_up && d.due && d.due < "2026-04-15";
        case "tag_has": return c.value && d.tags.includes(c.value);
        default: return true;
      }
    })
  );
}

function CondInput({ cond, onChange }) {
  const upd = (v) => onChange({ ...cond, value: v });
  const sel = { padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, background: "#fff", fontFamily: "inherit", flex: 1, minWidth: 0 };
  const inp = { ...sel, fontSize: 13 };
  switch (cond.type) {
    case "program_has": case "program_not":
      return (<select style={sel} value={cond.value} onChange={(e) => upd(e.target.value)}><option value="">Pilih program...</option>{PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}</select>);
    case "segmen":
      return (<select style={sel} value={cond.value} onChange={(e) => upd(e.target.value)}><option value="">Pilih...</option>{["champions", "loyal", "potential", "at_risk", "lost", "new", "one_time"].map((s) => <option key={s} value={s}>{s}</option>)}</select>);
    case "status":
      return (<select style={sel} value={cond.value} onChange={(e) => upd(e.target.value)}><option value="">Pilih...</option>{["aktif", "mati", "diblokir", "opt_out"].map((s) => <option key={s} value={s}>{s}</option>)}</select>);
    case "assigned_to":
      return (<select style={sel} value={cond.value} onChange={(e) => upd(e.target.value)}><option value="">Pilih PIC...</option>{PIC_USERS.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}</select>);
    case "follow_up":
      return (<select style={sel} value={cond.value} onChange={(e) => upd(e.target.value)}><option value="">Pilih...</option>{["in_progress", "waiting_callback", "closing", "failed"].map((s) => <option key={s} value={s}>{s}</option>)}</select>);
    case "last_donation_after": case "last_donation_before":
      return (<input type="date" style={inp} value={cond.value} onChange={(e) => upd(e.target.value)} />);
    case "total_gte": case "total_lte": case "count_gte":
      return (<input type="number" style={inp} placeholder="Angka" value={cond.value} onChange={(e) => upd(e.target.value)} />);
    case "tag_has":
      return (<input style={inp} placeholder="Tag..." value={cond.value} onChange={(e) => upd(e.target.value)} />);
    default:
      return (<span style={{ flex: 1, fontSize: 12, color: "#888", padding: "7px 0" }}>Otomatis</span>);
  }
}

function QueryBuilder({ conditions, onChange, resultCount, onClose, onSave }) {
  const btn = (primary) => ({ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: primary ? P : "#e8e8e8", color: primary ? "#fff" : "#333", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" });
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 18, marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "2px solid #01665a30" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Filter size={18} color={P} /><span style={{ fontSize: 15, fontWeight: 700, color: P }}>Advanced Query Builder</span></div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><X size={18} /></button>
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>Semua kondisi di-AND-kan. Klik + untuk tambah.</div>
      {conditions.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#999", width: 30, flexShrink: 0 }}>{i === 0 ? "IF" : "AND"}</span>
          <select style={{ padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, background: "#fff", fontFamily: "inherit", minWidth: 160 }} value={c.type} onChange={(e) => { const n = [...conditions]; n[i] = { type: e.target.value, value: "" }; onChange(n); }}>
            {COND_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
          </select>
          <CondInput cond={c} onChange={(v) => { const n = [...conditions]; n[i] = v; onChange(n); }} />
          <button onClick={() => onChange(conditions.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", padding: 4, flexShrink: 0 }}><Trash2 size={15} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={() => onChange([...conditions, { type: "program_has", value: "" }])} style={btn(false)}><Plus size={13} /> Tambah Kondisi</button>
        <button onClick={() => onChange([])} style={btn(false)}><RefreshCw size={13} /> Reset</button>
        {onSave && <button onClick={onSave} style={btn(true)}><Target size={13} /> Simpan Segment</button>}
        <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: P }}>{resultCount} donatur cocok</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BULK TOOLBAR
   ═══════════════════════════════════════════════════════════════ */

function BulkToolbar({ count, checkedIds, onUpdate, onClear }) {
  const [mode, setMode] = useState(null);
  const [targetPic, setTargetPic] = useState("");
  const [fromPic, setFromPic] = useState("");
  const [toPic, setToPic] = useState("");

  const btn = (primary) => ({ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: primary ? P : "#e8e8e8", color: primary ? "#fff" : "#333", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" });

  const doAssign = () => { if (!targetPic) return; onUpdate((d) => checkedIds.has(d.id) ? { ...d, assigned_to: +targetPic } : d); setMode(null); onClear(); };
  const doMigrate = () => { if (!fromPic || !toPic || fromPic === toPic) return; onUpdate((d) => d.assigned_to === +fromPic ? { ...d, assigned_to: +toPic } : d); setMode(null); onClear(); };
  const doUnassign = () => { onUpdate((d) => checkedIds.has(d.id) ? { ...d, assigned_to: null } : d); onClear(); };

  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "1px solid #01665a30" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <UserCheck size={16} color={P} />
          <strong style={{ color: P }}>{count} dipilih</strong>
        </div>
        <button onClick={() => setMode(mode === "assign" ? null : "assign")} style={btn(mode === "assign")}><UserCheck size={13} /> Assign PIC</button>
        <button onClick={doUnassign} style={btn(false)}><X size={13} /> Unassign</button>
        <button onClick={() => setMode(mode === "migrate" ? null : "migrate")} style={btn(mode === "migrate")}><Shuffle size={13} /> Migrasi</button>
        <button onClick={onClear} style={{ ...btn(false), marginLeft: "auto" }}><X size={13} /> Batal</button>
      </div>
      {mode === "assign" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#555" }}>Assign ke:</span>
          <select style={{ padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, background: "#fff", fontFamily: "inherit", minWidth: 160 }} value={targetPic} onChange={(e) => setTargetPic(e.target.value)}>
            <option value="">Pilih PIC...</option>
            {PIC_USERS.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </select>
          <button onClick={doAssign} disabled={!targetPic} style={{ ...btn(!!targetPic), opacity: targetPic ? 1 : 0.5 }}><Check size={13} /> Terapkan</button>
        </div>
      )}
      {mode === "migrate" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#555" }}>Dari:</span>
          <select style={{ padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, background: "#fff", fontFamily: "inherit", minWidth: 140 }} value={fromPic} onChange={(e) => setFromPic(e.target.value)}>
            <option value="">PIC asal...</option>
            {PIC_USERS.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </select>
          <ArrowRight size={16} color="#999" />
          <select style={{ padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, background: "#fff", fontFamily: "inherit", minWidth: 140 }} value={toPic} onChange={(e) => setToPic(e.target.value)}>
            <option value="">PIC tujuan...</option>
            {PIC_USERS.filter((u) => String(u.id) !== fromPic).map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </select>
          <button onClick={doMigrate} disabled={!fromPic || !toPic} style={{ ...btn(!!(fromPic && toPic)), opacity: fromPic && toPic ? 1 : 0.5 }}><Check size={13} /> Migrasi</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: DASHBOARD
   ═══════════════════════════════════════════════════════════════ */

function Dashboard() {
  const segD = useMemo(() => { const m = {}; INIT_DONORS.filter((d) => d.segmen).forEach((d) => { m[d.segmen] = (m[d.segmen] || 0) + 1; }); return Object.entries(m).map(([name, value]) => ({ name, value })); }, []);
  const moD = useMemo(() => { const m = {}; TRANSACTIONS.filter((t) => t.status === "paid").forEach((t) => { const mo = t.tgl.substring(0, 7); m[mo] = (m[mo] || 0) + t.nominal; }); return Object.entries(m).sort().slice(-12).map(([b, t]) => ({ bulan: b.substring(2), total: t })); }, []);
  const bP = BLAST_BATCHES.map((b) => ({ nama: cName(b.campaign_id)?.substring(0, 18) || "Batch " + b.id, terkirim: b.terkirim, closing: b.closing }));
  const totD = INIT_DONORS.filter((d) => d.status === "aktif").length;
  const totA = INIT_DONORS.reduce((s, d) => s + d.total, 0);
  const oC = INIT_DONORS.filter((d) => d.follow_up === "in_progress" && d.due && d.due < "2026-04-15").length;
  const PC = ["#01665a", "#2e8b7a", "#5cb8a8", "#e74c3c", "#95a5a6", "#3498db", "#f39c12"];

  const statBox = (label, value, color, icon) => (
    <div style={{ background: "#fff", borderRadius: 10, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", textAlign: "center", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 4 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><Activity size={20} color={P} /><h1 style={{ fontSize: 20, fontWeight: 700, color: P, margin: 0 }}>Dashboard CRM</h1></div>
      <p style={{ color: "#666", margin: "0 0 16px", fontSize: 13 }}>Relawan Nusantara — April 2026</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {statBox("Donatur Aktif", totD, P, <Users size={16} />)}
        {statBox("Total Donasi", fmtRp(totA), "#2e8b7a", <Wallet size={16} />)}
        {statBox("Transaksi", TRANSACTIONS.filter((t) => t.status === "paid").length, "#3498db", <TrendingUp size={16} />)}
        {statBox("Overdue", oC, "#e74c3c", <AlertTriangle size={16} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: P, margin: "0 0 10px" }}>Tren Donasi</h2>
          <ResponsiveContainer width="100%" height={220}><BarChart data={moD}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="bulan" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1e6 ? (v / 1e6) + "jt" : v >= 1e3 ? (v / 1e3) + "rb" : v} /><Tooltip formatter={(v) => fmtRp(v)} /><Bar dataKey="total" fill={P} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
        <div style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: P, margin: "0 0 10px" }}>Segmen RFM</h2>
          <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={segD} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name}(${value})`}>{segD.map((_, i) => <Cell key={i} fill={PC[i % PC.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: P, margin: "0 0 10px" }}>Closing per Campaign</h2>
        <ResponsiveContainer width="100%" height={180}><BarChart data={bP} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="nama" type="category" width={140} tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="terkirim" fill="#5cb8a8" name="Terkirim" /><Bar dataKey="closing" fill={P} name="Closing" /></BarChart></ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: DONORS (with Query Builder + Bulk)
   ═══════════════════════════════════════════════════════════════ */

function DonorsPage({ donors, setDonors, onDetail }) {
  const [search, setSearch] = useState("");
  const [showQB, setShowQB] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [checked, setChecked] = useState(new Set());

  const filtered = useMemo(() => {
    let r = donors;
    if (search) r = r.filter((d) => d.nama.toLowerCase().includes(search.toLowerCase()) || d.no_hp.includes(search));
    if (conditions.length) r = applyConditions(r, conditions);
    return r;
  }, [donors, search, conditions]);

  const btn = (primary) => ({ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: primary ? P : "#e8e8e8", color: primary ? "#fff" : "#333", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Users size={20} color={P} /><h1 style={{ fontSize: 20, fontWeight: 700, color: P, margin: 0 }}>Donors ({filtered.length})</h1></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowQB(!showQB)} style={btn(showQB)}><Filter size={13} /> Filter {conditions.length > 0 && `(${conditions.length})`}</button>
          <button style={btn(true)}><Plus size={13} /> Tambah</button>
        </div>
      </div>
      {showQB && (
        <QueryBuilder conditions={conditions} onChange={setConditions} resultCount={filtered.length} onClose={() => setShowQB(false)} onSave={() => alert("Segment disimpan: " + filtered.length + " donatur")} />
      )}
      <div style={{ marginBottom: 10 }}>
        <div style={{ position: "relative", maxWidth: 300 }}>
          <Search size={15} style={{ position: "absolute", left: 9, top: 8, color: "#999" }} />
          <input style={{ padding: "7px 10px 7px 30px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} placeholder="Cari nama / HP..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {checked.size > 0 && (
        <BulkToolbar count={checked.size} checkedIds={checked} onUpdate={(fn) => setDonors((prev) => prev.map(fn))} onClear={() => setChecked(new Set())} />
      )}
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <DataTable data={filtered} onRow={onDetail} selectable checked={checked} onCheck={setChecked} columns={[
          { label: "ID", key: "id" },
          { label: "Nama", render: (d) => <span style={{ fontWeight: 600 }}>{d.nama}</span> },
          { label: "No. HP", key: "no_hp" },
          { label: "Status", render: (d) => <Badge color={STC[d.status] || "#999"}>{d.status}</Badge> },
          { label: "Segmen", render: (d) => d.segmen ? <Badge color={SC[d.segmen]}>{d.segmen}</Badge> : "—" },
          { label: "RFM", render: (d) => <RfmDisplay r={d.skor_r} f={d.skor_f} m={d.skor_m} /> },
          { label: "Total", render: (d) => fmtRp(d.total) },
          { label: "PIC", render: (d) => d.assigned_to ? uName(d.assigned_to) : <span style={{ color: "#ccc" }}>—</span> },
          { label: "Follow-up", render: (d) => { if (!d.follow_up) return "—"; const ov = d.due && d.due < "2026-04-15"; return <Badge color={ov ? "#e74c3c" : "#f39c12"}>{d.follow_up}{ov ? <AlertTriangle size={10} style={{ marginLeft: 3, verticalAlign: "middle" }} /> : null}</Badge>; } },
        ]} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: DONOR DETAIL
   ═══════════════════════════════════════════════════════════════ */

function DonorDetail({ donor, onBack }) {
  const trx = TRANSACTIONS.filter((t) => t.donor_id === donor.id);
  const notes = PROSPECT_NOTES.filter((n) => n.donor_id === donor.id);
  const [tab, setTab] = useState("transaksi");
  const btn = (primary) => ({ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: primary ? P : "#e8e8e8", color: primary ? "#fff" : "#333", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" });
  const card = { background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button style={btn(false)} onClick={onBack}><ArrowLeft size={13} /> Kembali</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: P, margin: 0 }}>{donor.nama}</h1>
        <Badge color={STC[donor.status]}>{donor.status}</Badge>
        {donor.segmen && <Badge color={SC[donor.segmen]}>{donor.segmen}</Badge>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><CircleDot size={12} /> IDENTITAS</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div><strong>No. HP:</strong> {donor.no_hp}</div>
            <div><strong>Email:</strong> {donor.email || "—"}</div>
            <div><strong>RFM:</strong> <RfmDisplay r={donor.skor_r} f={donor.skor_f} m={donor.skor_m} /></div>
            <div><strong>PIC:</strong> {donor.assigned_to ? uName(donor.assigned_to) : "—"}</div>
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: "#888", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Wallet size={12} /> DONASI</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div><strong>Total:</strong> {fmtRp(donor.total)}</div>
            <div><strong>Transaksi:</strong> {donor.count}x</div>
            <div><strong>Terakhir:</strong> {fmtRp(donor.last_nom)} ({donor.last_at || "—"})</div>
            <div><strong>Program:</strong> {pName(donor.last_prog_id)}</div>
          </div>
        </div>
        <div style={{ ...card, borderLeft: `4px solid ${SC[donor.segmen] || "#ccc"}` }}>
          <div style={{ fontSize: 10, color: "#888", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Target size={12} /> SKOR RFM</div>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 12 }}>
            {[{ l: "Recency", v: donor.skor_r }, { l: "Frequency", v: donor.skor_f }, { l: "Monetary", v: donor.skor_m }].map((s) => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: P }}>{s.v ?? "-"}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button style={btn(tab === "transaksi")} onClick={() => setTab("transaksi")}><Wallet size={13} /> Transaksi ({trx.length})</button>
        <button style={btn(tab === "prospek")} onClick={() => setTab("prospek")}><FileText size={13} /> Prospek ({notes.length})</button>
      </div>
      <div style={card}>
        {tab === "transaksi" && <DataTable data={trx} columns={[{ label: "ID", key: "id" }, { label: "Tanggal", key: "tgl" }, { label: "Program", render: (r) => pName(r.program_id) }, { label: "Campaign", render: (r) => r.campaign_id ? cName(r.campaign_id) : "—" }, { label: "Nominal", render: (r) => fmtRp(r.nominal) }, { label: "Status", render: (r) => <Badge color={r.status === "paid" ? P : "#f39c12"}>{r.status}</Badge> }, { label: "Sumber", key: "sumber" }]} />}
        {tab === "prospek" && <DataTable data={notes} columns={[{ label: "Tgl", key: "tgl" }, { label: "PIC", render: (r) => uName(r.user_id) }, { label: "Channel", render: (r) => <Badge color={r.channel.includes("whatsapp") ? "#25D366" : "#999"}>{r.channel}</Badge> }, { label: "Respon", render: (r) => <Badge color={r.respon === "closing" ? P : r.respon === "merespon" ? "#3498db" : "#f39c12"}>{r.respon}</Badge> }, { label: "Catatan", key: "catatan" }, { label: "Source", render: (r) => <Badge color={r.source === "chrome_extension" ? "#4285f4" : "#999"}>{r.source === "chrome_extension" ? "Ext" : "Web"}</Badge> }]} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: SAVED SEGMENTS (with create)
   ═══════════════════════════════════════════════════════════════ */

function SavedSegmentsPage() {
  const [segments, setSegments] = useState(SAVED_SEGMENTS_INIT);
  const [showQB, setShowQB] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [segName, setSegName] = useState("");
  const resultCount = applyConditions(INIT_DONORS, conditions).length;
  const btn = (primary) => ({ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: primary ? P : "#e8e8e8", color: primary ? "#fff" : "#333", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" });

  const doSave = () => {
    if (!segName.trim()) return;
    setSegments((prev) => [...prev, { id: prev.length + 1, nama: segName, count: resultCount, refresh: "manual", is_public: true, oleh: 1 }]);
    setShowQB(false);
    setSegName("");
    setConditions([]);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Target size={20} color={P} /><h1 style={{ fontSize: 20, fontWeight: 700, color: P, margin: 0 }}>Saved Segments ({segments.length})</h1></div>
        <button onClick={() => setShowQB(!showQB)} style={btn(true)}><Plus size={13} /> Buat Segment</button>
      </div>
      {showQB && (
        <div style={{ background: "#fff", borderRadius: 10, padding: 18, marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06)", border: "2px solid #01665a30" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Target size={18} color={P} /><span style={{ fontSize: 15, fontWeight: 700, color: P }}>Buat Segment Baru</span></div>
            <button onClick={() => setShowQB(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}><X size={18} /></button>
          </div>
          <input style={{ padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box", marginBottom: 10 }} placeholder="Nama segment..." value={segName} onChange={(e) => setSegName(e.target.value)} />
          {conditions.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#999", width: 30 }}>{i === 0 ? "IF" : "AND"}</span>
              <select style={{ padding: "7px 10px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, background: "#fff", fontFamily: "inherit", minWidth: 160 }} value={c.type} onChange={(e) => { const n = [...conditions]; n[i] = { type: e.target.value, value: "" }; setConditions(n); }}>
                {COND_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
              <CondInput cond={c} onChange={(v) => { const n = [...conditions]; n[i] = v; setConditions(n); }} />
              <button onClick={() => setConditions(conditions.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c" }}><Trash2 size={15} /></button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => setConditions([...conditions, { type: "program_has", value: "" }])} style={btn(false)}><Plus size={13} /> Tambah Kondisi</button>
            <button onClick={doSave} disabled={!segName.trim()} style={{ ...btn(!!segName.trim()), opacity: segName.trim() ? 1 : 0.5 }}><Check size={13} /> Simpan ({resultCount} donatur)</button>
          </div>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <DataTable data={segments} columns={[
          { label: "ID", key: "id" },
          { label: "Nama", render: (r) => <strong>{r.nama}</strong> },
          { label: "Donatur", render: (r) => <strong style={{ color: P }}>{r.count.toLocaleString()}</strong> },
          { label: "Refresh", render: (r) => <Badge>{r.refresh}</Badge> },
          { label: "Public", render: (r) => r.is_public ? "✓" : "—" },
          { label: "Oleh", render: (r) => uName(r.oleh) },
          { label: "Aksi", render: () => <button style={btn(true)}><Download size={12} /> CSV</button> },
        ]} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: WORKLIST
   ═══════════════════════════════════════════════════════════════ */

function WorklistPage({ donors }) {
  const assigned = donors.filter((d) => d.assigned_to && d.status === "aktif").sort((a, b) => {
    const sc = (d) => d.follow_up === "in_progress" && d.due && d.due < "2026-04-15" ? 1000 : d.segmen === "at_risk" ? 500 : d.segmen === "champions" ? 400 : 0;
    return sc(b) - sc(a);
  });
  const ps = {};
  assigned.forEach((d) => { if (!ps[d.assigned_to]) ps[d.assigned_to] = { t: 0, o: 0 }; ps[d.assigned_to].t++; if (d.follow_up && d.due && d.due < "2026-04-15") ps[d.assigned_to].o++; });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><ClipboardList size={20} color={P} /><h1 style={{ fontSize: 20, fontWeight: 700, color: P, margin: 0 }}>Workload Tim</h1></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
        {Object.entries(ps).map(([uid, s]) => (
          <div key={uid} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,.06)", textAlign: "center" }}>
            <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><UserCheck size={13} color={P} />{uName(+uid)}</div>
            <div style={{ display: "flex", justifyContent: "space-around", fontSize: 12 }}>
              <div><div style={{ fontSize: 16, fontWeight: 700, color: P }}>{s.t}</div>Assigned</div>
              <div><div style={{ fontSize: 16, fontWeight: 700, color: "#e74c3c" }}>{s.o}</div>Overdue</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: P, margin: "0 0 10px" }}>Priority Order</h2>
        <DataTable data={assigned} columns={[
          { label: "Prio", render: (d) => { const p = d.follow_up === "in_progress" && d.due && d.due < "2026-04-15" ? 1000 : d.segmen === "at_risk" ? 500 : d.segmen === "champions" ? 400 : 0; return <strong style={{ color: p >= 1000 ? "#e74c3c" : p >= 500 ? "#f39c12" : P }}>{p}</strong>; } },
          { label: "Donatur", render: (d) => <strong>{d.nama}</strong> },
          { label: "Segmen", render: (d) => d.segmen ? <Badge color={SC[d.segmen]}>{d.segmen}</Badge> : "—" },
          { label: "Total", render: (d) => fmtRp(d.total) },
          { label: "PIC", render: (d) => uName(d.assigned_to) },
          { label: "Status", render: (d) => d.follow_up ? <Badge color={d.due && d.due < "2026-04-15" ? "#e74c3c" : "#f39c12"}>{d.follow_up}</Badge> : "—" },
          { label: "Due", render: (d) => d.due || "—" },
        ]} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GENERIC TABLE PAGE
   ═══════════════════════════════════════════════════════════════ */

function GenericPage({ icon: Ic, title, data, columns, addLabel }) {
  const btn = (primary) => ({ padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: primary ? P : "#e8e8e8", color: primary ? "#fff" : "#333", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" });
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Ic size={20} color={P} /><h1 style={{ fontSize: 20, fontWeight: 700, color: P, margin: 0 }}>{title} ({data.length})</h1></div>
        {addLabel && <button style={btn(true)}><Plus size={13} /> {addLabel}</button>}
      </div>
      <div style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <DataTable data={data} columns={columns} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════════════════════════ */

const NAV = [
  { group: "OVERVIEW", items: [{ key: "dashboard", label: "Dashboard", Icon: LayoutDashboard }, { key: "worklist", label: "Worklist", Icon: ClipboardList }] },
  { group: "CRM", items: [{ key: "donors", label: "Donors", Icon: Users }, { key: "programs", label: "Programs", Icon: Bookmark }, { key: "campaigns", label: "Campaigns", Icon: Megaphone }, { key: "transactions", label: "Transactions", Icon: Wallet }, { key: "segments", label: "Segments", Icon: Target }] },
  { group: "BLASTING", items: [{ key: "blast", label: "Blast Batches", Icon: Send }, { key: "notes", label: "Prospect Notes", Icon: FileText }, { key: "vendors", label: "Vendors", Icon: Plug }] },
  { group: "CONFIG", items: [{ key: "fields", label: "Fields", Icon: Settings }, { key: "users", label: "Users", Icon: KeyRound }, { key: "imports", label: "Imports", Icon: FolderUp }, { key: "ext", label: "Extensions", Icon: Puzzle }, { key: "config", label: "Config", Icon: Wrench }] },
];

const LOGO_URL = "https://erp.relawannusantara.org/web/image/cnt_cf.res_company/18/logo_perusahaan_putih/18.png?w=100&h=42&q=100&upscale=true&auto=compress,format";

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [detail, setDetail] = useState(null);
  const [donors, setDonors] = useState(INIT_DONORS);
  const [logoOk, setLogoOk] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  // Auto-close sidebar on mobile
  useEffect(() => { if (isMobile) setSidebarOpen(false); }, [isMobile]);

  const go = (k) => { setPage(k); setDetail(null); if (isMobile) setSidebarOpen(false); };

  const codeBadge = (v) => <code style={{ fontSize: 12, background: "#f5f5f5", padding: "2px 6px", borderRadius: 4 }}>{v}</code>;

  const renderPage = () => {
    if (detail) return <DonorDetail donor={detail} onBack={() => setDetail(null)} />;
    switch (page) {
      case "dashboard": return <Dashboard />;
      case "worklist": return <WorklistPage donors={donors} />;
      case "donors": return <DonorsPage donors={donors} setDonors={setDonors} onDetail={setDetail} />;
      case "segments": return <SavedSegmentsPage />;
      case "programs": return <GenericPage icon={Bookmark} title="Programs" data={PROGRAMS} addLabel="Tambah" columns={[{ label: "ID", key: "id" }, { label: "Slug", render: (r) => codeBadge(r.slug) }, { label: "Nama", render: (r) => <strong>{r.nama}</strong> }, { label: "Kategori", render: (r) => <Badge>{r.kategori}</Badge> }, { label: "Status", render: (r) => r.is_active ? <Badge color={P}>Aktif</Badge> : <Badge color="#999">Off</Badge> }]} />;
      case "campaigns": return <GenericPage icon={Megaphone} title="Campaigns" data={CAMPAIGNS} addLabel="Tambah" columns={[{ label: "ID", key: "id" }, { label: "Slug", render: (r) => codeBadge(r.slug) }, { label: "Nama", render: (r) => <strong>{r.nama}</strong> }, { label: "Program", render: (r) => r.program_id ? pName(r.program_id) : <span style={{ color: "#999" }}>Cross</span> }, { label: "Tipe", render: (r) => <Badge>{r.tipe}</Badge> }]} />;
      case "transactions": return <GenericPage icon={Wallet} title="Transactions" data={TRANSACTIONS} columns={[{ label: "ID", key: "id" }, { label: "Donatur", render: (r) => INIT_DONORS.find((d) => d.id === r.donor_id)?.nama || "—" }, { label: "Program", render: (r) => pName(r.program_id) }, { label: "Campaign", render: (r) => r.campaign_id ? cName(r.campaign_id) : "—" }, { label: "Tgl", key: "tgl" }, { label: "Nominal", render: (r) => fmtRp(r.nominal) }, { label: "Status", render: (r) => <Badge color={r.status === "paid" ? P : "#f39c12"}>{r.status}</Badge> }]} />;
      case "blast": return <GenericPage icon={Send} title="Blast Batches" data={BLAST_BATCHES} addLabel="Import" columns={[{ label: "ID", key: "id" }, { label: "Campaign", render: (r) => r.campaign_id ? cName(r.campaign_id) : "—" }, { label: "Vendor", render: (r) => vName(r.vendor_id) }, { label: "Tgl", key: "tgl" }, { label: "Target", render: (r) => r.target.toLocaleString() }, { label: "Terkirim", render: (r) => r.terkirim.toLocaleString() }, { label: "Closing", render: (r) => <strong style={{ color: P }}>{r.closing}</strong> }, { label: "Rate", render: (r) => <strong>{(100 * r.closing / r.terkirim).toFixed(1)}%</strong> }]} />;
      case "notes": return <GenericPage icon={FileText} title="Prospect Notes" data={PROSPECT_NOTES} columns={[{ label: "ID", key: "id" }, { label: "Donatur", render: (r) => INIT_DONORS.find((d) => d.id === r.donor_id)?.nama || "—" }, { label: "PIC", render: (r) => uName(r.user_id) }, { label: "Tgl", key: "tgl" }, { label: "Channel", render: (r) => <Badge color={r.channel.includes("whatsapp") ? "#25D366" : "#999"}>{r.channel}</Badge> }, { label: "Respon", render: (r) => <Badge color={r.respon === "closing" ? P : "#3498db"}>{r.respon}</Badge> }, { label: "Catatan", key: "catatan" }]} />;
      case "vendors": return <GenericPage icon={Plug} title="Vendor Profiles" data={VENDOR_PROFILES} addLabel="Tambah" columns={[{ label: "ID", key: "id" }, { label: "Nama", render: (r) => <strong>{r.nama}</strong> }, { label: "Default", render: (r) => r.is_default ? <Badge color={P}>Default</Badge> : "—" }]} />;
      case "fields": return <GenericPage icon={Settings} title="Dynamic Fields" data={FIELD_DEFS} addLabel="Tambah" columns={[{ label: "ID", key: "id" }, { label: "Slug", render: (r) => codeBadge(r.slug) }, { label: "Label", render: (r) => <strong>{r.label}</strong> }, { label: "Tipe", render: (r) => <Badge>{r.tipe}</Badge> }, { label: "Searchable", render: (r) => r.is_searchable ? "✓" : "—" }]} />;
      case "users": return <GenericPage icon={KeyRound} title="Users" data={USERS_DATA} addLabel="Tambah" columns={[{ label: "ID", key: "id" }, { label: "Nama", render: (r) => <strong>{r.nama}</strong> }, { label: "Email", key: "email" }, { label: "Role", render: (r) => <Badge color={r.role === "admin" ? P : r.role === "supervisor" ? "#2e8b7a" : r.role === "tim_blast" ? "#f39c12" : "#95a5a6"}>{r.role}</Badge> }, { label: "Worklist", render: (r) => { const c = donors.filter((d) => d.assigned_to === r.id).length; return c ? <strong>{c}</strong> : "—"; } }]} />;
      case "imports": return <GenericPage icon={FolderUp} title="Data Imports" data={DATA_IMPORTS} addLabel="Upload" columns={[{ label: "ID", key: "id" }, { label: "Tipe", render: (r) => <Badge>{r.type}</Badge> }, { label: "File", render: (r) => <span style={{ fontFamily: "monospace", fontSize: 11 }}>{r.file}</span> }, { label: "Total", render: (r) => r.total.toLocaleString() }, { label: "Baru", render: (r) => r.new_r.toLocaleString() }, { label: "Status", render: (r) => <Badge color={P}>{r.status}</Badge> }]} />;
      case "ext":
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Puzzle size={20} color={P} /><h1 style={{ fontSize: 20, fontWeight: 700, color: P, margin: 0 }}>Extensions</h1></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              {EXT_CONFIGS.map((e, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.06)", borderLeft: `4px solid ${e.is_active ? P : "#ddd"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{e.ext_type.replace(/_/g, " ").toUpperCase()}</strong>
                    <Badge color={e.is_active ? P : "#999"}>{e.status}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>{e.desc}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "config": return <GenericPage icon={Wrench} title="App Config" data={[{ key: "app_name", value: "CRM Relawan Nusantara" }, { key: "timezone", value: "Asia/Jakarta" }, { key: "blast_cooldown_days", value: "14" }, { key: "rfm_window_months", value: "12" }, { key: "version", value: "2.0.0" }]} columns={[{ label: "Key", render: (r) => codeBadge(r.key) }, { label: "Value", render: (r) => <strong>{r.value}</strong> }]} />;
      default: return <Dashboard />;
    }
  };

  const sidebarW = isMobile ? "85vw" : 220;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Source Sans Pro',sans-serif", fontSize: 14, color: "#1a1a1a", background: "#f4f5f7", overflow: "hidden", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <div style={{
        width: sidebarW, minWidth: sidebarW, background: P, color: "#fff",
        display: "flex", flexDirection: "column", overflow: "auto",
        position: isMobile ? "fixed" : "relative",
        left: sidebarOpen ? 0 : (isMobile ? "-100%" : 0),
        top: 0, bottom: 0, zIndex: 50,
        transition: "left .3s ease, width .3s ease",
        ...((!isMobile && !sidebarOpen) ? { width: 0, minWidth: 0, overflow: "hidden", padding: 0 } : {}),
      }}>
        <div style={{ padding: "14px 16px 8px", borderBottom: "1px solid rgba(255,255,255,.15)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {logoOk
              ? <img src={LOGO_URL} alt="RN" referrerPolicy="no-referrer" crossOrigin="anonymous" style={{ height: 28 }} onError={() => setLogoOk(false)} />
              : <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Shield size={16} /><span style={{ fontSize: 13, fontWeight: 700 }}>Relawan Nusantara</span></div>
            }
            <div style={{ fontSize: 9, opacity: 0.45, marginTop: 3 }}>CRM v2.0 — Superadmin</div>
          </div>
          {isMobile && <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><X size={20} /></button>}
          {!isMobile && <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer" }}><ChevronLeft size={18} /></button>}
        </div>
        {NAV.map((g) => (
          <div key={g.group}>
            <div style={{ padding: "10px 0 3px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 1, opacity: 0.45, textTransform: "uppercase" }}>{g.group}</div>
            {g.items.map((it) => (
              <div key={it.key}
                onClick={() => go(it.key)}
                style={{
                  padding: "7px 12px 7px 14px", cursor: "pointer", fontSize: 13,
                  fontWeight: page === it.key && !detail ? 700 : 400,
                  background: page === it.key && !detail ? "rgba(255,255,255,.15)" : "transparent",
                  borderLeft: page === it.key && !detail ? "3px solid #fff" : "3px solid transparent",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                <it.Icon size={15} strokeWidth={page === it.key ? 2.5 : 1.8} /> {it.label}
              </div>
            ))}
          </div>
        ))}
        <div style={{ marginTop: "auto", padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,.12)", fontSize: 10, opacity: 0.45, display: "flex", alignItems: "center", gap: 5 }}>
          <Shield size={11} /> Admin Sistem
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ padding: "10px 20px", background: "#fff", borderBottom: "1px solid #e8e8e8", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {(!sidebarOpen || isMobile) && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: P, padding: 4 }}>
              <Menu size={22} />
            </button>
          )}
          <span style={{ fontSize: 13, color: "#888" }}>CRM Relawan Nusantara</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? 12 : 20 }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
