# Product Requirements Document
# CRM Relawan Nusantara

**Versi:** 2.1  
**Tanggal:** 4 November 2026  
**Status:** Draft — Internal CNT · diselaraskan dengan implementasi Fase 1  
**Dibuat oleh:** Tim CNT  
**Untuk:** Relawan Nusantara (RN)

---

## Daftar Isi

1. [Latar Belakang & Problem Statement](#1-latar-belakang--problem-statement)
2. [Prinsip Desain Produk](#2-prinsip-desain-produk)
3. [Arsitektur Independensi](#3-arsitektur-independensi)
4. [Scope & Out-of-Scope](#4-scope--out-of-scope)
5. [Fitur Inti (Core Features)](#5-fitur-inti-core-features)
6. [Dynamic Donor Fields — Struktur Data Fleksibel](#6-dynamic-donor-fields--struktur-data-fleksibel)
7. [Advanced Query Engine — Pencarian Multi-Kondisi](#7-advanced-query-engine--pencarian-multi-kondisi)
8. [Multi-Tim CRM — Workload & Assignment](#8-multi-tim-crm--workload--assignment)
9. [Extension: web.whatsapp Overlay](#9-extension-webwhatsapp-overlay)
10. [Extension Layer — Integrasi Opsional Lainnya](#10-extension-layer--integrasi-opsional-lainnya)
11. [Data Model](#11-data-model)
12. [User Stories](#12-user-stories)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Roadmap](#14-roadmap)
15. [Asumsi & Risiko](#15-asumsi--risiko)

---

## 1. Latar Belakang & Problem Statement

### 1.1 Konteks

Relawan Nusantara (RN) adalah organisasi donasi yang mengelola ribuan donatur aktif. Ekosistem operasional RN saat ini melibatkan: **ZAINS** (sistem finance, dikembangkan CNT), **CF/Donol** (platform crowdfunding, dikembangkan CNT), dan beberapa **vendor blasting WhatsApp** pihak ketiga (Wappin, Mekari Qontak, Cekat AI — sering berganti).

### 1.2 Masalah Utama

Seluruh aktivitas CRM RN dilakukan **secara manual melalui Excel** tanpa sistem yang mendukung:

- Data donatur tersebar dan duplikat — normalisasi, deduplikasi, dan pengisian kolom riwayat donasi manual oleh Data Analyst
- Tidak ada **profil donatur terpadu** — riwayat transaksi, riwayat prospek, dan status kontak tidak bisa dilihat dalam satu tampilan
- **Tidak bisa query temporal lintas-program** — pertanyaan seperti "donatur yang qurban tahun lalu tapi belum qurban tahun ini" tidak bisa dijawab tanpa Excel manual
- Tidak ada **segmentasi berbasis data** — RFM pernah dicoba tapi gagal karena tidak ada tooling
- Biaya blasting ±Rp 23 juta/blast dengan target tidak tersegmentasi
- **Tim CRM tidak bisa di-assign dan dimonitor workload-nya** — semua di spreadsheet shared tanpa tracking
- Struktur data donatur **kaku** — setiap kebutuhan field baru harus request ke developer

### 1.3 Mengapa Bukan Pakai CRM Bawaan Vendor?

CRM bawaan Mekari Qontak atau Wappin tidak bisa menjadi solusi karena **source of truth donatur RN ada di ZAINS dan CF**. CRM vendor hanya tahu interaksi WhatsApp, tidak tahu riwayat transaksi atau status donasi. CRM custom berbasis ZAINS/CF adalah satu-satunya pilihan yang bisa menjawab pertanyaan seperti "siapa yang donasi Ramadan tahun lalu tapi belum tahun ini?"

---

## 2. Prinsip Desain Produk

Lima prinsip ini adalah guardrails yang tidak boleh dilanggar selama pengembangan:

### P1 — Independen, Tidak Bergantung pada Sistem Lain untuk Beroperasi

> CRM harus bisa berjalan dan memberikan nilai meskipun ZAINS down, CF tidak tersedia, atau RN sedang ganti vendor blasting.

Integrasi bersifat **additive**, bukan **required**. Core CRM (profiling, searching, prospecting) berjalan dari data yang sudah ada di DB CRM sendiri.

### P2 — Data Masuk Bisa dari Mana Saja

CRM menerima data melalui berbagai jalur — sync otomatis ZAINS/CF (jika tersedia), upload manual CSV/Excel (selalu tersedia sebagai fallback), import laporan blast dari vendor manapun, atau input manual. **Upload file adalah jalur yang tidak pernah mati.**

### P3 — Integrasi adalah Extension, Bukan Inti

Setiap integrasi ke sistem eksternal dibangun sebagai **extension/plugin terpisah** yang bisa diaktifkan atau dinonaktifkan tanpa mempengaruhi fungsi inti. Ganti vendor = update extension saja, bukan rebuild CRM.

### P4 — Minimal User Editing, Maksimal Otomasi

Setiap pekerjaan yang saat ini dilakukan manual (normalisasi No. HP, deduplikasi, klasifikasi status blast, pengisian kolom riwayat) harus diotomasi. User hanya edit yang memang domain mereka.

### P5 — Struktur Data Fleksibel, Performa Tidak Boleh Berkompromi

Field donatur bisa bertambah kapan saja tanpa request ke developer — tapi performa pencarian dan tampilan profil harus tetap secepat sistem dengan skema statis. Fleksibilitas dan kecepatan bukan trade-off, keduanya wajib terpenuhi.

---

## 3. Arsitektur Independensi

### 3.1 DB CRM Mandiri

```
┌──────────────────────────────────────────────────────────────┐
│                         DB CRM                                │
│                                                               │
│  ┌───────────────────┐    ┌────────────────────────────┐     │
│  │  Replika           │    │  DB Operasional CRM         │     │
│  │  (Read-Only)       │    │  (Milik CRM sepenuhnya)     │     │
│  │                    │    │                             │     │
│  │  • Replika ZAINS   │    │  • Profil Donatur (Core)    │     │
│  │  • Replika CF      │    │  • Dynamic Fields Store     │     │
│  │  (jika tersedia)   │    │  • Transaction Index        │     │
│  │                    │    │  • Riwayat Blast            │     │
│  │  Sync berkala /    │    │  • Catatan Prospek          │     │
│  │  on-demand /       │    │  • Assignment Tim           │     │
│  │  upload manual     │    │  • Segmen & Query Tersimpan │     │
│  └───────────────────┘    └────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Tiga Mode Operasional

| Mode | Kondisi | Data Masuk | Write-back ke ZAINS |
|---|---|---|---|
| **A — Standalone** | ZAINS/CF tidak tersedia / belum siap | Upload CSV/Excel | Antrian manual |
| **B — Semi-Integrated** | ZAINS dedicated, CF belum | Upload + Sync selektif | Service API |
| **C — Fully Integrated** | ZAINS dedicated + CF repo terpisah | Replikasi penuh near real-time | Service API |

Mode bisa berbeda per lembaga yang menggunakan CRM ini — satu lembaga Mode A, lembaga lain Mode C, berjalan di sistem yang sama.

---

## 4. Scope & Out-of-Scope

### 4.1 Dalam Scope

| ✅ | Fitur |
|---|---|
| ✅ | Profil donatur terpadu (360° view) |
| ✅ | Dynamic fields — field donatur bisa ditambah kapan saja tanpa coding |
| ✅ | Advanced query multi-kondisi termasuk kondisi temporal lintas-program |
| ✅ | Riwayat transaksi donatur (min. 3 tahun, filterable) |
| ✅ | Segmentasi & scoring RFM otomatis |
| ✅ | Multi-tim CRM — assignment, workload tracking, progress per PIC |
| ✅ | Generator daftar target prospek (output: CSV siap upload ke vendor apapun) |
| ✅ | Import laporan blast (format standar, configurable per vendor) |
| ✅ | Klasifikasi otomatis status kegagalan blast |
| ✅ | Update status donatur ke ZAINS via API (atau antrian manual) |
| ✅ | Catatan prospek & follow-up per donatur |
| ✅ | Upload data donatur & transaksi via file |
| ✅ | Normalisasi & deduplikasi otomatis |
| ✅ | Audit trail perubahan data |
| ✅ | RBAC — hak akses berbasis role |
| ✅ | Dashboard analitik |
| ✅ | **Extension: web.whatsapp Overlay** (Chrome extension, fokus utama) |
| ✅ | Extension layer untuk integrasi lainnya (ZAINS, CF, vendor WA) |

### 4.2 Out-of-Scope

| ❌ | Fitur | Status |
|---|---|---|
| ❌ | Scheduling blast di dalam CRM | Bisa jika ada MoU vendor |
| ❌ | Retry otomatis blast | Bisa jika ada MoU vendor |
| ❌ | Integrasi real-time Wappin/Mekari/Cekat | Candidate Extension Layer |
| ❌ | Alur konfirmasi donasi inbound (chat → CRM) | Terlalu banyak dependency vendor |
| ❌ | Pencatatan arus kas / pembukuan | Domain ZAINS |
| ❌ | Pemrosesan donasi langsung | Domain CF |

---

## 5. Fitur Inti (Core Features)

### 5.1 Profil Donatur Terpadu

Setiap donatur memiliki satu halaman profil yang menjadi pusat semua informasi.

```
┌─ IDENTITAS ─────────────────────────────────────────────────────┐
│  Nama Lengkap        No. HP (canonical)     Email               │
│  ID Donatur (ZAINS)  Tgl. Registrasi        Status Kontak        │
│  Tags / Label        Segmen RFM             Skor Prospek         │
│  [Dynamic Fields — tampil sesuai field yang aktif di lembaga]   │
└─────────────────────────────────────────────────────────────────┘

┌─ RINGKASAN DONASI ──────────────────────────────────────────────┐
│  Total Donasi (lifetime)    Donasi Terakhir (tgl + nominal)     │
│  Frekuensi Donasi           Program Donasi Favorit              │
│  Nominal Rata-rata          Tren (naik/turun/stabil)            │
│  Partisipasi Program        [list program pernah diikuti]       │
└─────────────────────────────────────────────────────────────────┘

┌─ RIWAYAT TRANSAKSI (tab) ───────────────────────────────────────┐
│  Tabel: Tgl | Program | Campaign | Nominal | Status | Sumber    │
│  Filter: periode, program, nominal range, status                │
│  Highlight: periode donasi berulang (Ramadan, Qurban, dll.)     │
└─────────────────────────────────────────────────────────────────┘

┌─ RIWAYAT PROSPEK (tab) ─────────────────────────────────────────┐
│  Tabel: Tgl | PIC | Campaign | Respon | Keterangan              │
│  Input respon langsung dari tab ini                             │
└─────────────────────────────────────────────────────────────────┘

┌─ RIWAYAT BLAST (tab) ───────────────────────────────────────────┐
│  Tabel: Tgl | Campaign | Status | Detail Kegagalan              │
└─────────────────────────────────────────────────────────────────┘

┌─ DYNAMIC FIELDS (tab) ──────────────────────────────────────────┐
│  Semua field custom yang ditambahkan admin — tampil di sini      │
│  Editable sesuai permission role                                │
└─────────────────────────────────────────────────────────────────┘
```

**Aturan edit:**
- Field dari ZAINS/CF (nama, No. HP, nominal): read-only, update via Service API
- Field CRM (catatan prospek, status follow-up, tag, dynamic fields): editable sesuai role
- Semua perubahan tercatat di audit trail
- Field dinamis yang `visible_in` mencakup **list** tampil sebagai kolom di daftar donatur (bisa show/hide); yang **export** ikut file Excel meski kolom disembunyikan
- Profil donatur: edit identitas CRM (nama, email, status) + form field dinamis + chip label

### 5.1.1 Standar tabel (semua halaman list)

Setiap `DataTable`:

- Pencarian in-table, pagination, pilih kolom (show/hide)
- Tombol **Excel** — kolom file = kolom yang terlihat (+ field yang ditandai export); termasuk kolom No
- Tanggal/waktu ditampilkan humanize zona **WIB (Asia/Jakarta)** lengkap sampai **jam:menit:detik**, contoh `10 Apr 2026, 07.00.00 WIB` (berlaku juga di Excel)
- Boolean tampil Ya/Tidak

### 5.1.2 Identitas lembaga

Singleton `org_profile`: nama, nama singkat, tagline, warna primary/sidebar/accent, logo dan favicon (Vercel Blob). Favicon browser = favicon lembaga atau crop dari logo — bukan favicon default Next.js. Sidebar memakai logo + warna lembaga.

### 5.1.3 Pengguna (CRUD)

Menu **Konfigurasi → Pengguna**: tambah / edit (nama, email, role, aktif, ganti password opsional) / soft-delete. Email unik. Tidak boleh menghapus akun sendiri. Role: `admin | supervisor | data_analyst | tim_blast | read_only`.

### 5.2 Import Laporan Blast

Alur setelah blasting selesai (tidak ada perubahan cara kerja Tim Blast di sisi vendor):

```
1. Tim Blast unduh laporan dari platform vendor (CSV/Excel, format apapun)
2. Upload laporan ke CRM → halaman "Import Laporan Blast"
3. CRM auto-detect mapping kolom vendor (konfigurasi tersimpan per vendor profile)
4. CRM klasifikasikan setiap record:
   → Terkirim
   → Gagal: Limit Meta
   → Gagal: Nomor Tidak Aktif  (→ update status permanen)
   → Gagal: Nomor Diblokir     (→ update status permanen)
   → Gagal: Tidak Terdaftar WA
   → Dibaca / Tidak Dibaca
   → Ada Respon / Tidak Ada Respon
5. Preview klasifikasi → konfirmasi apply
6. Update riwayat blast di profil donatur
7. Update status kontak di DB CRM
8. Antrian write-back ke ZAINS (via API atau flagged untuk upload manual)
```

### 5.3 Generator Daftar Target Prospek

```
1. Buka halaman "Buat Daftar Prospek"
2. Pilih filter (lihat §7 untuk detail kondisi yang didukung)
3. Preview: "X donatur memenuhi semua kondisi"
4. Konfigurasi kolom output (nama, no. HP, campaign terakhir, dll.)
5. Export → CSV/Excel siap upload ke platform vendor
```

**Aturan otomatis (selalu aktif, tidak bisa di-bypass kecuali admin):**
- Status `mati`, `diblokir`, `opt_out` → tidak pernah masuk daftar
- Donatur yang diblast < X hari terakhir → tidak masuk (X configurable, default 14 hari)

### 5.4 Upload & Ingest Data

```
Sumber yang diterima:
├── Upload CSV/Excel donatur  (dari ZAINS export atau sumber manapun)
├── Upload CSV/Excel transaksi
├── Sync otomatis (jika Mode B/C aktif)
└── Input manual satu donatur

Proses ingest otomatis:
1. Normalisasi No. HP → format canonical 62xxxxxxxxxx
2. Deduplikasi berbasis No. HP canonical → merge record, preserve semua ID ZAINS
3. Validasi field wajib
4. Preview: record baru / merge / skip (error)
5. Konfirmasi apply
```

---

## 6. Dynamic Donor Fields — Struktur Data Fleksibel

### 6.1 Latar Belakang & Kebutuhan

Kebutuhan data donatur berkembang terus. Hari ini RN butuh field "Wilayah Donatur", besok butuh "Preferensi Program", lusa butuh "Status Zakat Fitrah". Jika setiap penambahan field harus request developer dan menunggu deployment, CRM akan menjadi hambatan bukan alat bantu.

**Solusi: Dynamic Fields** — admin dapat mendefinisikan field baru sendiri, kapan saja, tanpa coding, tanpa deployment.

### 6.2 Cara Kerja dari Sisi Admin

```
Admin buka menu: Pengaturan → Field Donatur → Tambah Field

Isi:
  Nama Field    : [Wilayah Donatur]
  Tipe Data     : [Dropdown ▼]  ← pilihan: Text, Number, Date, 
                                   Boolean (Ya/Tidak), Dropdown, 
                                   Multi-select, URL, Phone
  Opsi (jika Dropdown/Multi-select):
                  [Jabodetabek] [Jawa Barat] [Jawa Tengah] [+Tambah]
  Wajib diisi?  : [ ] Ya  [✓] Tidak
  Tampil di     : [✓] Profil  [✓] Daftar  [✓] Export  [ ] API saja
  Bisa disearch?: [✓] Ya  → otomatis masuk ke Advanced Query Engine
  Editable oleh : [✓] Admin  [✓] Data Analyst  [ ] Tim Blast  [ ] CS

Simpan → Field langsung tersedia di semua profil donatur
```

### 6.3 Arsitektur Teknis: EAV + Materialized Column

Tantangan dynamic fields adalah **performa** — query "donatur di Jabodetabek dengan RFM ≥ 4" tidak boleh lambat meski field "Wilayah Donatur" baru dibuat kemarin.

**Pendekatan: Hybrid EAV + Materialized Column**

```
Lapisan 1 — EAV Store (fleksibel, untuk semua field)
┌─────────────────────────────────────────────────────┐
│  donor_dynamic_fields                               │
│  ┌──────────┬──────────────┬──────────────────────┐ │
│  │ donor_id │ field_def_id │ value (jsonb)        │ │
│  ├──────────┼──────────────┼──────────────────────┤ │
│  │ uuid-123 │ fld_wilayah  │ "Jabodetabek"        │ │
│  │ uuid-123 │ fld_pref     │ ["Ramadan","Qurban"] │ │
│  └──────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────┘

Lapisan 2 — Materialized Search Index (cepat, untuk query)
┌─────────────────────────────────────────────────────┐
│  donor_search_index                                 │
│  ┌──────────┬─────────────────────────────────────┐ │
│  │ donor_id │ search_doc (tsvector / jsonb index) │ │
│  ├──────────┼─────────────────────────────────────┤ │
│  │ uuid-123 │ { wilayah: "jabodetabek",           │ │
│  │          │   pref: ["ramadan","qurban"],        │ │
│  │          │   rfm_r: 4, rfm_f: 3, rfm_m: 5,    │ │
│  │          │   last_donation: "2025-03-15",       │ │
│  │          │   programs_ever: ["ramadan_2024",    │ │
│  │          │                   "qurban_2024"] }   │ │
│  └──────────┴─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Mekanisme update Search Index:**
- Setiap perubahan field donatur (core maupun dynamic) → trigger async update ke `donor_search_index`
- Update bersifat incremental (hanya donor yang berubah)
- Index selesai di-rebuild dalam < 500ms per donatur
- Query selalu menghit `donor_search_index`, bukan EAV store langsung

**Hasilnya:** Admin bisa tambah field baru kapan saja → field otomatis masuk ke search index → tersedia di Advanced Query Engine tanpa restart atau deploy ulang.

### 6.4 Field Wajib (Core Fields, Tidak Bisa Dihapus)

```
• nama_lengkap          • no_hp_canonical      • tgl_registrasi
• status_kontak         • segmen_rfm           • skor_r, skor_f, skor_m
• tags[]                • linked_zains_ids[]
```

`tags[]` menyimpan **slug** label (bukan teks bebas acak di UI). Katalog label terpisah — lihat §6.6. Field dinamis **bukan** pengganti tag: satu field `multiselect` tidak cukup untuk label tak terbatas yang mudah dilepas satu-satu.

### 6.6 Label Donatur (Tags) — Terpisah dari Dynamic Fields

Admin mengelola katalog di menu **Konfigurasi → Label donatur** (`tag_definitions`): nama tampilan, warna chip, aktif/nonaktif. Slug immutable.

Per donatur: banyak label sekaligus (chip). Tambah dari katalog atau ketik label baru (upsert katalog + `array_append`). Hapus per chip. Nilai di `donors.tags TEXT[]`; search index `search_doc.tags`; filter GIN (`@>` / `&&`).

**Filter multi-label (Query Builder):** satu kondisi Label, centang banyak slug, operator **berisi semua** (`tags @> ARRAY[...]`) atau **berisi salah satu** (`tags && ARRAY[...]`). Bisa dikombinasi AND/OR dengan RFM, status, dan field dinamis.

**Daftar & export:** kolom Label di tabel donatur (chip, show/hide). Excel mengekspor nama tampilan, dipisah koma — sama dengan yang terlihat di tabel.

### 6.5 Contoh Field Dinamis yang Mungkin Ditambahkan RN

| Field | Tipe | Kegunaan |
|---|---|---|
| Wilayah | Dropdown | Segmentasi geografis |
| Preferensi Program | Multi-select | Personalisasi campaign |
| Profesi | Text | Segmentasi demografis |
| Status Donatur Tetap | Boolean | Filtering prospek prioritas |
| Channel Pertama Kenal RN | Dropdown | Analisis akuisisi |
| Catatan Khusus Internal | Text | Catatan sensitif, hanya admin |

---

## 7. Advanced Query Engine — Pencarian Multi-Kondisi

### 7.1 Konsep

Query Engine adalah jantung dari nilai CRM ini. Pertanyaan bisnis yang selama ini tidak terjawab harus bisa dijawab dalam hitungan detik — bukan jam kerja Excel.

**Jenis kondisi yang didukung:**

```
Tipe A — Kondisi Atribut Donatur
  "wilayah = Jabodetabek"
  "status_kontak = aktif"
  "segmen_rfm = at_risk"
  "tags berisi 'prioritas'"
  "[dynamic field apapun] = [nilai]"

Tipe B — Kondisi Transaksi Absolut
  "pernah donasi program X"
  "nominal donasi terakhir > Rp 500.000"
  "total donasi lifetime > Rp 5.000.000"
  "frekuensi donasi dalam 12 bulan ≥ 3"

Tipe C — Kondisi Temporal per Program (INI YANG KRITIS)
  "donasi program X dalam periode P1 TAPI TIDAK dalam periode P2"
  "donasi program X tahun lalu TAPI TIDAK tahun ini"
  "donasi Ramadan [tahun tertentu] TAPI BELUM Ramadan [tahun ini]"
  "donasi Qurban 2024 DAN donasi Ramadan 2025"
  "donasi minimal 2 program berbeda dalam 1 tahun terakhir"

Tipe D — Kondisi Aktivitas Blast
  "terakhir diblast > 14 hari lalu"
  "respon blast terakhir = 'merespon'"
  "belum pernah diblast campaign X"
  "pernah closing di campaign Y"

Tipe E — Kondisi Assignment
  "saat ini tidak di-assign ke siapapun"
  "di-assign ke PIC [nama]"
  "follow-up overdue > 7 hari"
```

### 7.2 Query Builder UI

Antarmuka yang memungkinkan tim non-teknis membangun query kompleks tanpa SQL:

```
┌─ ADVANCED QUERY BUILDER ──────────────────────────────────────────┐
│                                                                    │
│  SEMUA kondisi berikut harus terpenuhi (AND):                     │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ [Transaksi ▼] [program ▼] [=] [Ramadan ▼]                 │   │
│  │   [dalam periode] [1 Jan 2025 – 31 Mar 2025]              │   │
│  └────────────────────────────────────────────────────────────┘   │
│  + Tambah kondisi                                                  │
│                                                                    │
│  TIDAK memenuhi kondisi berikut (NOT):                            │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ [Transaksi ▼] [program ▼] [=] [Ramadan ▼]                 │   │
│  │   [dalam periode] [1 Jan 2026 – 31 Mar 2026]              │   │
│  └────────────────────────────────────────────────────────────┘   │
│  + Tambah kondisi NOT                                              │
│                                                                    │
│  ──────────────────────────────────────────────────────────────   │
│  Preview: Menemukan 2.847 donatur                    [Export CSV] │
│  ──────────────────────────────────────────────────────────────   │
│  [Simpan sebagai Segmen] [Buat Daftar Blast] [Lihat Daftar]       │
└───────────────────────────────────────────────────────────────────┘
```

### 7.3 Contoh Query Nyata yang Bisa Dijawab

**"Donatur yang Qurban 2024 tapi belum Qurban 2025"**
```
KONDISI:
  Transaksi.program = "Qurban"
  DAN Transaksi.tgl dalam [Jun 2024 – Jul 2024]
TIDAK KONDISI:
  Transaksi.program = "Qurban"
  DAN Transaksi.tgl dalam [Jun 2025 – Jul 2025]
```

**"Donatur Ramadan tahun lalu yang belum donasi Ramadan tahun ini"**
```
KONDISI:
  Transaksi.program = "Ramadan"
  DAN Transaksi.tgl dalam [Mar 2025 – Apr 2025]
TIDAK KONDISI:
  Transaksi.program = "Ramadan"
  DAN Transaksi.tgl dalam [Mar 2026 – Apr 2026]
```

**"Donatur aktif dengan donasi bulan lalu di program X tapi bulan ini belum"**
```
KONDISI:
  status_kontak = aktif
  DAN Transaksi.program = [program X]
  DAN Transaksi.tgl dalam [bulan lalu]
TIDAK KONDISI:
  Transaksi.program = [program X]
  DAN Transaksi.tgl dalam [bulan ini]
```

**"Donatur high-value yang belum pernah diprospek 30 hari terakhir"**
```
KONDISI:
  segmen_rfm dalam [champions, loyal]
  DAN (ProspekTerakhir.tgl < [30 hari lalu] ATAU belum pernah diprospek)
  DAN status_kontak = aktif
```

**"Donatur baru (< 3 bulan) yang sudah donasi lebih dari sekali"**
```
KONDISI:
  tgl_registrasi >= [90 hari lalu]
  DAN frekuensi_transaksi_total >= 2
```

### 7.4 Performa Query

Seluruh query diarahkan ke `donor_search_index` (lihat §6.3), bukan ke tabel transaksi raw.

Untuk kondisi temporal (Tipe C), index menyimpan struktur:
```json
"program_participation": {
  "ramadan": ["2023-Q1", "2024-Q1", "2025-Q1"],
  "qurban": ["2023-Q2", "2024-Q2"],
  "zakat_fitrah": ["2024-Q1", "2025-Q1"]
}
```

Query "qurban 2024 tapi belum 2025" → bitwise operation di index → sub-50ms untuk 500k donor.

**Target performa:**
- Simple filter (1-3 kondisi): < 500ms
- Complex query (5+ kondisi, termasuk temporal): < 3 detik
- Export 50.000 baris: < 30 detik

### 7.5 Segmen Tersimpan

Hasil query bisa disimpan sebagai **Segmen Tersimpan**:
- Bisa diberi nama dan deskripsi
- Bisa di-share ke semua user atau disimpan privat
- Bisa di-refresh on-demand atau dijadwalkan refresh otomatis (harian/mingguan)
- Digunakan sebagai sumber daftar blast berulang (misal: "Target Qurban tahunan")
- Menampilkan jumlah donatur saat ini dan perubahan dari refresh sebelumnya

---

## 8. Multi-Tim CRM — Workload & Assignment

### 8.1 Latar Belakang

CRM harus bisa mengcover dua kondisi ekstrem:
1. **Lembaga kecil** — 1-2 orang handle semua, tidak ada hierarki tim formal
2. **Lembaga besar** — banyak PIC dengan daftar donatur masing-masing, supervisor perlu monitor workload dan progress

Sistem assignment harus **opsional** — jika tidak dipakai, tidak mengganggu alur kerja.

### 8.2 Konsep Assignment

```
Satu donatur dapat di-assign ke satu PIC pada satu waktu.
Satu PIC bisa punya ratusan hingga ribuan donatur di worklistnya.
Assignment bisa dilakukan:
  - Manual: admin/supervisor pilih donatur → assign ke PIC
  - Bulk: generate daftar prospek → assign langsung ke PIC tertentu
  - Auto-distribute: sistem bagi merata dari pool ke semua PIC aktif
```

### 8.3 Fitur Multi-Tim

#### Dashboard Supervisor / Data Analyst Senior

```
┌─ WORKLOAD TIM ────────────────────────────────────────────────┐
│  Nama PIC         Assigned  Kontak Hari Ini  Closing  Pending │
│  ─────────────────────────────────────────────────────────── │
│  Budi Santoso     1.247     89               12       156     │
│  Rina Dewi        1.183     76               9        203     │
│  Ahmad Fauzi      1.312     102              15       87      │
│  [Unassigned]     4.821     —                —        —       │
└───────────────────────────────────────────────────────────────┘
```

#### Fitur per PIC (Tim Blast / CS)

- **Worklist personal** — daftar donatur yang di-assign ke saya, diurutkan berdasarkan prioritas (RFM, last contact, follow-up overdue)
- **Quick action dari worklist** — bisa langsung isi catatan respon tanpa buka profil lengkap
- **Status follow-up** — In Progress / Waiting Callback / Closing / Failed / Perlu Eskalasi
- **Reminder follow-up** — donatur yang sudah di-tag "Waiting Callback" dan sudah lewat X hari muncul sebagai notifikasi

#### Fitur Auto-Distribute

```
Supervisor buka: Workload → Auto-Distribute

Pilih:
  Sumber     : [Segmen: "Target Qurban 2025" ▼]
  Distribusi : [Merata ke semua PIC aktif ▼] atau [Pilih PIC tertentu]
  Prioritas  : [RFM Score tertinggi dulu ▼]
  Batasi     : [Max 500 donatur per PIC per distribusi]

Preview: 2.847 donatur → 6 PIC → ~475 donatur/PIC
[Jalankan Distribusi]
```

### 8.4 Hierarki Role

```
Admin
  └── akses penuh ke semua fitur + konfigurasi sistem

Supervisor / Data Analyst Senior
  └── lihat semua worklist PIC
  └── redistribute assignment
  └── akses semua laporan performa tim
  └── buat dan edit Segmen Tersimpan
  └── konfigurasi Dynamic Fields

Data Analyst
  └── upload & ingest data
  └── import laporan blast
  └── generate & export daftar prospek
  └── lihat semua profil donatur (read)
  └── tidak bisa edit field core

Tim Blast / PIC
  └── lihat worklist personal
  └── isi catatan prospek & respon donatur di donatur yang di-assign
  └── lihat profil donatur (read)
  └── tidak bisa akses donatur yang tidak di-assign (configurable)

Read-Only
  └── lihat profil dan laporan, tidak bisa edit apapun
```

---

## 9. Extension: web.whatsapp Overlay

### 9.1 Mengapa web.whatsapp?

Saat Tim CRM sedang membalas pesan donatur di web.whatsapp.com, mereka harus membuka tab lain, buka CRM, ketik nomor HP, tunggu load — baru tahu donatur ini siapa dan riwayatnya apa. Proses ini memutus alur kerja dan memperlambat respon.

Browser extension yang di-inject ke web.whatsapp memangkas semua langkah itu menjadi **tampilan otomatis di sidebar** tanpa pindah tab.

### 9.2 Cara Kerja Teknis

```
1. User install Chrome Extension "CRM RN" (sekali saja)
2. User buka web.whatsapp.com → login seperti biasa
3. Extension inject script ke halaman web.whatsapp
4. Saat user membuka chat dengan kontak:
   a. Extension extract No. HP dari DOM web.whatsapp
   b. Extension kirim request ke CRM API (authenticated dengan token user)
   c. CRM API kembalikan data profil donatur (< 300ms target)
   d. Extension render sidebar overlay di kanan layar
5. Sidebar tetap ter-update selama user berada di chat yang sama
6. Saat ganti chat → repeat langkah 4
```

### 9.3 Desain Sidebar Overlay

```
┌─ CRM RN ──────────────────────── [×] ─┐
│                                        │
│  ● DONATUR DITEMUKAN                   │
│  ──────────────────────────────────    │
│  Budi Rahmat Santoso                   │
│  ID: ZN-004821                         │
│                                        │
│  ┌─ SEGMEN ─────────────────────────┐  │
│  │  🔴 AT RISK   R:2  F:4  M:4     │  │
│  └──────────────────────────────────┘  │
│                                        │
│  DONASI TERAKHIR                       │
│  Ramadan 2025  •  Rp 500.000           │
│  15 Maret 2025  (87 hari lalu)         │
│                                        │
│  STATISTIK                             │
│  Total donasi   : Rp 4.250.000         │
│  Frekuensi/thn  : 3x                  │
│  Program rutin  : Ramadan, Qurban      │
│                                        │
│  STATUS KONTAK  : ✅ Aktif             │
│  TERAKHIR DIBLAST: 12 hari lalu        │
│  RESPON BLAST   : Hanya Read           │
│                                        │
│  CATATAN TERAKHIR                      │
│  ┌──────────────────────────────────┐  │
│  │ 10 Jun — Rina D.                │  │
│  │ "Tertarik qurban, minta info    │  │
│  │  lebih lanjut via WA"           │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ── AKSI CEPAT ─────────────────────  │
│  [✏ Catat Respon]  [📋 Profil Lengkap] │
│  [🏷 Tambah Tag]   [⚠ Tandai Opt-out] │
│                                        │
│  ── INPUT RESPON ───────────────────  │
│  Respon: [Merespon         ▼]          │
│  Catatan: [________________]           │
│  Campaign: [Qurban 2025    ▼]          │
│  [Simpan Catatan]                      │
│                                        │
└────────────────────────────────────────┘
```

**Jika nomor tidak ditemukan di CRM:**
```
┌─ CRM RN ──────────────────────── [×] ─┐
│                                        │
│  ○ DONATUR TIDAK DITEMUKAN             │
│  +62812-3456-7890                      │
│                                        │
│  [+ Tambah sebagai Donatur Baru]       │
│                                        │
└────────────────────────────────────────┘
```

### 9.4 Yang Bisa Dilakukan dari Sidebar (Tanpa Pindah Tab)

| Aksi | Keterangan |
|---|---|
| Lihat profil singkat | Nama, segmen RFM, status kontak, donasi terakhir |
| Lihat catatan terakhir | 3 catatan prospek terbaru |
| Isi catatan respon | Respon, campaign, catatan bebas → langsung tersimpan ke CRM |
| Tambah/hapus tag | Tag donatur real-time |
| Tandai opt-out | Donatur minta tidak dihubungi → langsung update status |
| Buka profil lengkap | Buka tab baru ke halaman profil donatur di CRM |
| Tambah donatur baru | Jika nomor belum terdaftar, buka form tambah donatur |

### 9.5 Yang Tidak Dilakukan Sidebar (By Design)

- Tidak mengirim pesan WhatsApp — sidebar hanya baca + catat, tidak intervensi ke chat
- Tidak menyimpan konten percakapan WhatsApp — privasi pengguna terjaga
- Tidak butuh akses ke konten chat — hanya butuh No. HP yang aktif di tampilan
- Tidak otomatis membuka chat baru — semua inisiasi chat tetap di tangan user

### 9.6 Keamanan Extension

- Authentication via token user CRM (OAuth atau API Key per user) — bukan password
- Token disimpan di Chrome's secure storage, bukan localStorage
- Semua request ke CRM API via HTTPS
- Extension tidak bisa membaca isi chat — hanya membaca DOM untuk ekstrak No. HP
- Jika token expired → sidebar tampilkan "Session expired, login ulang" tanpa fallback

### 9.7 Resiliensi terhadap Perubahan DOM web.whatsapp

web.whatsapp bisa berubah struktur HTML-nya kapan saja. Untuk mengantisipasi:

```
Strategi selector berlapis:
1. Primary selector: cari berdasarkan aria-label atau data-id (lebih stabil)
2. Fallback selector: cari berdasarkan class pattern (lebih rapuh tapi backup)
3. Emergency fallback: tampilkan input manual No. HP di sidebar
   → user ketik nomor → lookup tetap jalan meski auto-detect gagal

Monitoring:
- Extension melaporkan ke server jika auto-detect gagal > 3x berturut-turut
- CNT mendapat notifikasi dan bisa update selector dalam hitungan jam
  tanpa user perlu update extension (selector dikontrol server-side)
```

### 9.8 Potensi Ekspansi ke Platform Lain

Karena extensi berbasis browser dan menggunakan arsitektur yang sama, dapat dikembangkan untuk:

| Platform | Cara Kerja | Effort Tambahan |
|---|---|---|
| Mekari Qontak (web) | Inject sidebar saat buka conversation | Rendah — buat selector baru |
| Wappin (web) | Inject sidebar saat buka conversation | Rendah — buat selector baru |
| Web app internal lainnya | Idem | Rendah |
| Email client (Gmail) | Extract email address, lookup donatur | Sedang — logic ekstraksi berbeda |
| Platform apapun berbasis web | Tergantung struktur platform | Rendah–Sedang |

---

## 10. Extension Layer — Integrasi Opsional Lainnya

### 10.1 Extension: ZAINS Sync

**Prerequisite:** ZAINS RN di server dedicated (bukan shared).

**Kapabilitas:**
- Sync incremental data donatur dan transaksi dari ZAINS
- Write-back: update status donatur dari CRM ke ZAINS via Service API
- Conflict resolution: ZAINS menang untuk field finansial; CRM menang untuk field prospek
- Jika server belum dipisah → gunakan Upload Manual (Mode A)

### 10.2 Extension: CF Sync

**Prerequisite:** CF RN di repo terpisah agar custom endpoint dapat dibuat.

**Kapabilitas:**
- Sync data donatur baru dari CF
- Sync status checkout (pending/completed)
- Pemisahan tampilan data checkout dari data transaksi valid

### 10.3 Extension: Vendor Blasting API (Future, dengan MoU)

**Prerequisite:** MoU resmi CNT ↔ vendor terkait.

**Kapabilitas (jika MoU tersedia):**
- Upload daftar target blast langsung dari CRM ke platform vendor
- Terima status pengiriman real-time (tidak perlu unduh laporan H+1)
- Sync respon donatur otomatis ke profil CRM

**Prinsip:** Bangun satu vendor dulu (vendor yang paling stabil digunakan RN), validasi polanya, baru pertimbangkan vendor berikutnya.

---

## 11. Data Model

### 11.1 Core Entities

```
Donor
├── id_crm                    UUID — primary key di CRM
├── linked_zains_ids[]        Array semua ID Donatur di ZAINS (pre-dedup)
├── nama_lengkap
├── no_hp_canonical           Format 62xxxxxxxxxx — unique key
├── no_hp_variants[]          Format asli sebelum normalisasi (history)
├── email
├── tgl_registrasi
├── sumber_registrasi         zains | cf | manual | upload
├── status_kontak             aktif | tidak_aktif | mati | diblokir | opt_out
├── segmen_rfm                champions | loyal | potential | at_risk | lost | new | one_time
├── skor_r, skor_f, skor_m   Integer 1–5
├── tags[]                    TEXT[] — slug label dari TagDefinition (multi)
├── assigned_to               FK → User (nullable)
├── follow_up_status          null | in_progress | waiting_callback | closing | failed | escalate
├── follow_up_due_date        Date (nullable)
├── created_at, updated_at
└── last_synced_at

Transaction
├── id_transaksi
├── donor_id                  FK → Donor
├── id_transaksi_zains
├── tgl_transaksi
├── bulan_program             YYYY-MM — indexed, untuk query temporal
├── nominal
├── program                   indexed
├── campaign
├── status                    paid | pending | failed
├── sumber                    zains | cf | manual | upload
└── created_at

FieldDefinition (definisi field dinamis)
├── id_field
├── slug                      "wilayah_donatur" — unique, immutable
├── label                     "Wilayah Donatur" — tampil di UI
├── tipe                      text | number | date | boolean | dropdown | multiselect | url | phone
├── options[]                 Untuk dropdown/multiselect
├── is_required               boolean
├── is_searchable             boolean — jika true, masuk ke search index
├── visible_in                profil | list | export | api
├── editable_by[]             roles yang boleh edit
├── is_active                 boolean
└── created_at

DonorDynamicField (nilai field dinamis per donatur)
├── donor_id                  FK → Donor
├── field_def_id              FK → FieldDefinition
├── value_text | value_number | value_date | value_boolean | value_json
└── updated_at

TagDefinition (katalog label — terpisah dari FieldDefinition)
├── id
├── slug                      immutable, unique — nilai yang disimpan di donors.tags
├── nama                      tampilan UI / Excel
├── warna                     hex chip
├── deskripsi
├── is_active
└── created_at, updated_at

OrgProfile (singleton identitas lembaga)
├── nama, nama_singkat, tagline
├── logo_url, favicon_url     Vercel Blob
├── primary_color, sidebar_color, accent_color
└── updated_at

DonorSearchIndex (materialized, rebuilt on change)
├── donor_id                  FK → Donor — unique
├── search_doc                jsonb — semua field yang searchable, di-flatten
│   {
│     nama: "budi santoso",
│     no_hp: "6281234567890",
│     status: "aktif",
│     rfm_r: 2, rfm_f: 4, rfm_m: 4,
│     segmen: "at_risk",
│     tags: ["prioritas"],
│     last_donation_date: "2025-03-15",
│     last_donation_program: "ramadan",
│     last_donation_nominal: 500000,
│     program_participation: {
│       ramadan: ["2023-Q1","2024-Q1","2025-Q1"],
│       qurban:  ["2023-Q2","2024-Q2"]
│     },
│     dynamic: {
│       wilayah_donatur: "jabodetabek",
│       preferensi_program: ["ramadan","qurban"]
│     },
│     assigned_to_id: "user-uuid",
│     last_prospected_at: "2025-06-10",
│     last_blast_at: "2025-06-01",
│     last_blast_response: "hanya_read"
│   }
├── updated_at
└── search_vector             tsvector — untuk full-text search nama/catatan

BlastRecord
├── id_blast_record
├── donor_id                  FK → Donor
├── blast_batch_id            FK → BlastBatch
├── tgl_kirim
├── status_kirim              terkirim | gagal_limit | nomor_mati | diblokir | tidak_terdaftar
├── dibaca                    boolean | null
├── respon                    belum | dibaca | merespon | closing | memblokir
├── vendor                    wappin | mekari | cekat | lainnya
└── raw_vendor_status

BlastBatch
├── id_batch
├── nama_campaign
├── tgl_blast
├── vendor
├── vendor_profile_id         FK → VendorProfile (mapping kolom)
├── jumlah_target
├── jumlah_terkirim, jumlah_gagal
├── file_laporan_vendor
└── diimport_oleh             FK → User

VendorProfile (konfigurasi mapping kolom per vendor)
├── id_vendor_profile
├── nama_vendor               "Wappin v2", "Mekari Qontak", dll.
├── column_mapping            jsonb — {no_hp: "Phone Number", status: "Delivery Status", ...}
├── status_mapping            jsonb — {"Delivered": "terkirim", "Failed": "nomor_mati", ...}
└── is_default                boolean

ProspectNote
├── id_catatan
├── donor_id                  FK → Donor
├── user_id                   FK → User
├── tgl_prospek
├── channel                   wappin | mekari | cekat | manual | web_whatsapp_ext
├── campaign
├── respon_donatur            ceklis_satu | belum_merespon | hanya_read | merespon | closing | gagal | memblokir | nomor_tidak_valid | opt_out
├── catatan_bebas
└── created_at

SavedSegment
├── id_segmen
├── nama
├── deskripsi
├── query_json                Serialized query dari Query Builder
├── is_public                 boolean (bisa dilihat semua user)
├── dibuat_oleh               FK → User
├── auto_refresh              boolean
├── refresh_schedule          daily | weekly | manual
├── last_refreshed_at
├── last_count                jumlah donatur saat refresh terakhir
└── created_at

User
├── id_user
├── nama
├── email
├── password_hash
├── role                      admin | supervisor | data_analyst | tim_blast | read_only
├── is_active
├── last_login_at
├── created_at, updated_at, deleted_at

AuditLog
├── id_log
├── donor_id                  FK → Donor (nullable)
├── user_id                   FK → User
├── action                    create | update | delete | assign | import | export
├── entity_type               donor | transaction | blast_record | field_def, dll.
├── entity_id
├── field_changed             nullable
├── value_before              jsonb
├── value_after               jsonb
├── source                    web_app | chrome_extension | api | upload_import
└── created_at
```

---

## 12. User Stories

### 12.1 Admin

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-ADM-01 | Sebagai Admin, saya ingin menambah field baru "Wilayah Donatur" (tipe dropdown) tanpa minta bantuan developer, agar tim bisa langsung mengisi dan mencari berdasarkan wilayah. | Field tersedia di semua profil donatur dalam < 1 menit setelah disimpan; langsung bisa digunakan di Query Builder. |
| US-ADM-02 | Sebagai Admin, saya ingin mengkonfigurasi mapping kolom untuk file laporan blast vendor baru, agar import laporan tidak error meski format berbeda dari sebelumnya. | Mapping tersimpan; import file vendor baru berhasil dengan klasifikasi yang benar. |
| US-ADM-03 | Sebagai Admin, saya ingin melihat audit trail siapa yang mengubah status donatur tertentu, agar bisa investigasi jika ada data yang berubah tidak seharusnya. | Audit log menampilkan: user, waktu, field, nilai lama dan baru. |
| US-ADM-04 | Sebagai Admin, saya ingin men-deaktivasi field dinamis yang sudah tidak dipakai tanpa menghapus datanya, agar tidak membingungkan user tapi data historis tetap tersimpan. | Field tidak muncul di UI setelah dinonaktifkan; data di DB tetap ada dan bisa diaktifkan kembali. |
| US-ADM-05 | Sebagai Admin, saya ingin menambah/ubah/nonaktifkan field dinamis dari menu Field dinamis, dan field itu langsung muncul sebagai kolom donatur (bisa disembunyikan) serta ikut export Excel. | CRUD tanpa deploy; kolom list mengikuti `visible_in`; Excel memakai nilai tampilan (bukan raw ISO). |
| US-ADM-06 | Sebagai Admin, saya ingin katalog label donatur (nama, warna) dan menempel banyak label ke satu donatur, plus hapus per chip. | Katalog `tag_definitions`; `donors.tags[]` multi-slug; ketik label baru langsung masuk katalog. |
| US-ADM-07 | Sebagai Admin, saya ingin filter donatur berdasarkan beberapa label sekaligus (semua / salah satu) digabung kondisi lain. | Query Builder: multi-select label + AND/OR antar kondisi; hasil bisa di-Excel. |
| US-ADM-08 | Sebagai Admin, saya ingin CRUD pengguna (nama, email, role, password, aktif) dari menu Pengguna. | Tambah/edit/soft-delete; email unik; tidak bisa hapus diri sendiri. |
| US-ADM-09 | Sebagai Admin, saya ingin identitas lembaga (logo, favicon, warna, nama) tampil di sidebar dan tab browser. | `org_profile` + Blob; favicon bukan default Next.js. |

### 12.2 Supervisor / Data Analyst Senior

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-SUP-01 | Sebagai Supervisor, saya ingin melihat berapa donatur yang di-assign ke masing-masing PIC dan berapa yang sudah dihubungi hari ini, agar bisa memastikan workload merata. | Dashboard workload tim menampilkan data real-time per PIC: assigned, kontak hari ini, closing, pending. |
| US-SUP-02 | Sebagai Supervisor, saya ingin mendistribusikan 3.000 donatur "At Risk" secara merata ke 6 PIC aktif dengan satu klik, agar tidak ada PIC yang terlalu banyak atau terlalu sedikit daftar. | Distribusi selesai dalam < 30 detik; setiap PIC mendapat ±500 donatur; tidak ada donatur yang ter-assign dua kali. |
| US-SUP-03 | Sebagai Data Analyst Senior, saya ingin menyimpan query "donatur Qurban tahun lalu belum Qurban tahun ini" sebagai Segmen Tersimpan yang auto-refresh setiap minggu, agar Tim Blast bisa langsung pakai tanpa setup ulang. | Segmen tersimpan; count terupdate setiap minggu; Tim Blast bisa generate daftar blast dari segmen ini. |
| US-SUP-04 | Sebagai Data Analyst Senior, saya ingin melihat performa blast per campaign (delivery rate, respon rate, closing rate) dibandingkan antar periode, agar bisa merekomendasikan campaign mana yang paling efektif. | Dashboard campaign menampilkan metrik per BlastBatch; bisa difilter per periode dan vendor. |

### 12.3 Data Analyst

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-DA-01 | Sebagai Data Analyst, saya ingin mengupload file CSV donatur dari ZAINS dan sistem otomatis menormalisasi No. HP serta menghapus duplikat, agar saya tidak perlu bersihkan data manual di Excel. | Upload berhasil; preview menampilkan record baru/merge/error; No. HP tersimpan format 62xxx; duplikat ter-merge. |
| US-DA-02 | Sebagai Data Analyst, saya ingin mengupload laporan blast dari Wappin dan sistem otomatis mengklasifikasikan penyebab kegagalan, agar saya tidak perlu filter manual. | Klasifikasi akurat 4 kategori; preview sebelum apply; status donatur terupdate setelah apply. |
| US-DA-03 | Sebagai Data Analyst, saya ingin membuat daftar donatur yang berdonasi Ramadan 2025 tapi belum donasi apapun sejak April 2025, untuk campaign re-engagement. | Query multi-kondisi temporal berjalan < 3 detik; hasil akurat; bisa diexport ke CSV. |
| US-DA-04 | Sebagai Data Analyst, saya ingin melihat skor RFM tiap donatur terupdate otomatis setelah import data baru, tanpa harus trigger manual. | RFM terupdate dalam < 5 menit setelah import selesai. |
| US-DA-05 | Sebagai Data Analyst, saya ingin mencari donatur berdasarkan kombinasi: wilayah = Jabodetabek, segmen = At Risk, terakhir diblast > 14 hari, dalam satu query, agar langsung bisa generate daftar prospek. | Semua kondisi bisa dikombinasikan di Query Builder; hasil muncul < 3 detik. |
| US-DA-06 | Sebagai Data Analyst, saya ingin mengekspor tabel yang sedang saya lihat (kolom + filter + urutan yang sama) ke Excel dari tombol di tabel. | File .xlsx; tanggal WIB; label pakai nama tampilan. |

### 12.4 Tim Blast / PIC

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-TB-01 | Sebagai Tim Blast, saya ingin membuka worklist saya dan langsung tahu siapa yang harus dihubungi hari ini (paling prioritas), tanpa harus sortir spreadsheet. | Worklist diurutkan berdasarkan prioritas (overdue first, lalu RFM score); bisa difilter by status. |
| US-TB-02 | Sebagai Tim Blast, saya ingin mengisi catatan respon prospek langsung dari worklist (tanpa buka halaman profil) untuk donatur yang baru saya hubungi, agar lebih cepat. | Input respon dari worklist tersimpan dalam < 2 klik; profil donatur terupdate. |
| US-TB-03 | Sebagai Tim Blast, saya ingin membuka profil donatur dan melihat: kapan terakhir donasi, program apa, dan catatan prospek sebelumnya, agar tahu pendekatan terbaik. | Profil load < 2 detik; semua informasi relevan tampil tanpa scroll panjang. |
| US-TB-04 | Sebagai Tim Blast, saya ingin menandai donatur sebagai "Tidak Mau Dihubungi" langsung dari web.whatsapp saat donatur minta berhenti dihubungi, tanpa harus buka CRM di tab lain. | Extension sidebar di web.whatsapp memiliki tombol "Tandai Opt-out"; status terupdate ke CRM dalam < 3 detik. |
| US-TB-05 | Sebagai Tim Blast, saya ingin melihat informasi donatur (nama, segmen, donasi terakhir, catatan terakhir) langsung saat membuka chat di web.whatsapp, tanpa pindah tab. | Extension overlay muncul otomatis dalam < 1 detik saat chat terbuka; informasi akurat. |
| US-TB-06 | Sebagai Tim Blast, saya ingin mengisi catatan respon prospek langsung dari sidebar web.whatsapp setelah percakapan selesai, agar tidak lupa dan tidak perlu buka tab lain. | Form input di sidebar; setelah simpan, catatan muncul di riwayat prospek donatur di CRM. |

### 12.5 Management

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-MG-01 | Sebagai Management, saya ingin melihat dashboard yang menampilkan total donatur aktif, tren donasi bulanan, dan distribusi segmen RFM secara visual, untuk membuat keputusan strategi. | Dashboard load < 5 detik; grafik tren bulanan tersedia min. 12 bulan ke belakang. |
| US-MG-02 | Sebagai Management, saya ingin mengetahui berapa donatur Qurban 2024 yang belum Qurban 2025, agar bisa prioritaskan campaign Qurban tahun ini. | Angka tersedia via Segmen Tersimpan atau query on-demand; akurat dan real-time. |
| US-MG-03 | Sebagai Management, saya ingin melihat performa keseluruhan tim CRM (kontak per hari, closing rate, campaign terbaik) dalam satu laporan, untuk evaluasi bulanan. | Laporan tim tersedia; bisa difilter per periode; bisa diexport ke Excel. |

---

## 13. Non-Functional Requirements

### 13.1 Performa

| # | Requirement |
|---|---|
| NFR-01 | Query dengan 1–3 kondisi: < 500ms untuk dataset hingga 500k donatur |
| NFR-02 | Query dengan 5+ kondisi termasuk temporal multi-program: < 3 detik |
| NFR-03 | Halaman profil donatur (semua tab): load < 2 detik |
| NFR-04 | Extension sidebar web.whatsapp muncul: < 1 detik setelah chat terbuka |
| NFR-05 | Import file 50.000 baris: selesai < 5 menit |
| NFR-06 | Export 50.000 baris hasil query: selesai < 30 detik |
| NFR-07 | Rebuild `donor_search_index` per donatur setelah update: < 500ms |
| NFR-08 | Refresh RFM seluruh database: < 10 menit |
| NFR-09 | Auto-distribute 5.000 donatur ke 10 PIC: < 30 detik |

### 13.2 Fleksibilitas Data

| # | Requirement |
|---|---|
| NFR-10 | Field baru dapat ditambahkan oleh admin tanpa deployment: tersedia < 1 menit |
| NFR-11 | Field baru yang `is_searchable = true` langsung tersedia di Query Builder |
| NFR-12 | Field dapat di-deaktivasi tanpa menghapus data yang sudah ada |
| NFR-13 | Tidak ada batas jumlah field dinamis (dalam reason — max 200 field aktif) |
| NFR-13a | Label donatur tidak terbatas per donatur; katalog bisa ditambah tanpa deploy |
| NFR-13b | Semua timestamp di UI/Excel: zona Asia/Jakarta, format `d MMM yyyy, HH.mm.ss WIB` |

### 13.3 Keamanan & Integritas

| # | Requirement |
|---|---|
| NFR-14 | Semua akses wajib autentikasi; session timeout 8 jam inaktif |
| NFR-15 | RBAC 5 role dengan permission granular per fitur |
| NFR-16 | CRM tidak boleh write langsung ke replika ZAINS/CF — hanya via Service API |
| NFR-17 | Setiap perubahan data donatur tercatat di AuditLog |
| NFR-18 | Chrome extension menggunakan token per-user; tidak ada shared credential |
| NFR-19 | Extension tidak menyimpan data di browser (no localStorage, no IndexedDB) |
| NFR-20 | Extension tidak mengakses isi percakapan WhatsApp — hanya No. HP dari DOM |

### 13.4 Reliabilitas

| # | Requirement |
|---|---|
| NFR-21 | CRM beroperasi penuh (Mode A) meskipun ZAINS/CF tidak tersedia |
| NFR-22 | Update status donatur yang gagal dikirim ke ZAINS disimpan di antrian retry otomatis |
| NFR-23 | Import file bersifat atomic — tidak ada partial apply yang tidak bisa di-rollback |
| NFR-24 | Extension tetap bisa digunakan (input manual No. HP) meskipun auto-detect DOM gagal |

### 13.5 Maintainability

| # | Requirement |
|---|---|
| NFR-25 | Mapping kolom vendor blast dapat dikonfigurasi via UI admin tanpa deploy |
| NFR-26 | Selector DOM extension dapat diupdate server-side tanpa user perlu update extension |
| NFR-27 | Extension layer dapat diaktifkan/dinonaktifkan tanpa restart aplikasi utama |
| NFR-28 | Segmen RFM default (batas skor) dapat dikustomisasi admin tanpa ubah kode |

---

## 14. Roadmap

### Fase 0 — Prerequisite (Keputusan RN)

- [ ] Konfirmasi pemisahan ZAINS ke server dedicated
- [ ] Konfirmasi pemisahan repo CF RN
- [ ] Penunjukan Data Owner dari sisi RN
- [ ] Sign-off scope dokumen PRD ini

### Fase 1 — Core CRM Standalone (M1–M3)

**Sistem berjalan Mode A — tidak bergantung ZAINS/CF. Semua data via upload.**  
*Status Nov 2026: superadmin tanpa login (session admin seed). Auth next-auth menyusul.*

- [x] Setup DB CRM + Donor Search Index (Neon, raw SQL, migrasi + seed)
- [x] Dynamic Fields — CRUD admin; nilai per donatur; kolom list show/hide + Excel
- [x] Label donatur — katalog `tag_definitions`, multi-chip, filter berisi semua/salah satu, Excel nama tampilan
- [x] Identitas lembaga — `org_profile`, logo/favicon Blob, sidebar + favicon browser
- [x] Standar DataTable — cari, paging, kolom, Excel, tanggal WIB
- [x] Profil Donatur — identitas, field dinamis, label, transaksi, prospect notes
- [x] Query Builder UI — multi-kondisi AND/OR termasuk field dinamis + label
- [x] Segmen Tersimpan (simpan query)
- [x] Kalkulasi RFM
- [x] CRUD Pengguna (5 role)
- [x] Worklist PIC + dashboard ringkas
- [x] Audit Trail (mutasi API)
- [ ] Upload & Ingest CSV/Excel (donatur + transaksi) penuh: preview + dedup + apply atomic
- [ ] Generator Daftar Target Blast (export CSV vendor) streaming 50k
- [ ] Import Laporan Blast + klasifikasi penuh per VendorProfile
- [ ] Auto-distribute merata ke banyak PIC
- [ ] Login next-auth (saat ini Fase 1 superadmin tanpa login)

### Fase 2 — Integration Layer (M3–M6, setelah Fase 0 selesai)

- [ ] Extension: ZAINS Sync (replikasi + write-back via Service API)
- [ ] Extension: CF Sync
- [ ] Antrian retry write-back yang gagal
- [ ] Dashboard analitik (Looker atau setara)
- [ ] Auto-refresh Segmen Tersimpan

### Fase 3 — Extension & Enhancement (M6–M12)

- [ ] **Extension: web.whatsapp Overlay** (Chrome extension)
  - [ ] Auto-detect No. HP dari DOM
  - [ ] Sidebar profil donatur real-time
  - [ ] Quick action: catat respon, tambah tag, tandai opt-out
  - [ ] Server-side selector update (tanpa user reinstall)
  - [ ] Fallback input manual No. HP
- [ ] Ekspansi extension ke platform web lain (Mekari web, Wappin web)
- [ ] Extension: Vendor Blasting API (hanya jika MoU vendor tersedia)
- [ ] Performance scaling: indexing lanjut untuk > 500k donatur

---

## 15. Asumsi & Risiko

### 15.1 Asumsi

| # | Asumsi |
|---|---|
| A-01 | RN menyediakan data donatur dan transaksi dalam format CSV/Excel untuk import awal |
| A-02 | ZAINS dan CF akan menyediakan Service API untuk write-back — scope dikonfirmasi terpisah |
| A-03 | RN berkomitmen menunjuk Data Owner yang bertanggung jawab atas kualitas data |
| A-04 | Browser extension berjalan di Chrome; support browser lain dikerjakan kemudian |
| A-05 | CRM ini bisa digunakan oleh lebih dari satu lembaga (multi-tenant) — arsitektur DB harus memperhitungkan ini dari awal |

### 15.2 Risiko

| # | Risiko | Prob | Dampak | Mitigasi |
|---|---|---|---|---|
| R-01 | ZAINS masih shared server saat Fase 2 dimulai | Sedang | Tinggi | Fase 1 dirancang independen; Fase 2 hanya mulai setelah pemisahan |
| R-02 | RN ganti vendor blasting di tengah development | Tinggi | Rendah | VendorProfile dikonfigurasi via UI; ganti vendor = buat profile baru saja |
| R-03 | DOM web.whatsapp berubah → extension stop detect No. HP | Sedang | Sedang | Selector server-side; fallback input manual; monitoring otomatis |
| R-04 | Volume donatur > 500k — query lambat | Rendah | Tinggi | Fase 3 include scaling; Search Index dirancang untuk horizontal scale |
| R-05 | RN tidak tunjuk Data Owner → CRM "uncontrolled" lagi | Sedang | Tinggi | Masukkan sebagai syarat go-live; tanpa Data Owner, fitur edit terbatas untuk admin |
| R-06 | Admin tambah terlalu banyak dynamic field (>200) → performa index turun | Rendah | Sedang | Hard limit 200 field aktif; admin diberi warning saat mendekati limit |

---

## Changelog

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | April 2026 | Draft pertama |
| 2.0 | April 2026 | Tambah: User Stories Tim CRM, Dynamic Fields (§6), Advanced Query Engine (§7), Multi-Tim (§8), web.whatsapp Extension detail (§9), update data model, update NFR & roadmap |
| 2.1 | 4 Nov 2026 | Selaraskan implementasi Fase 1: katalog label (§6.6) terpisah dari field dinamis; DataTable Excel + tanggal WIB; CRUD pengguna; org_profile/favicon; field dinamis di list/export/filter; status roadmap |

---

*Living document — diupdate seiring validasi asumsi dan keputusan dari RN.*
