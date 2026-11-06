# Product Requirements Document
# ERP HRD — Absensi & Payroll IPA
# Ayam Bakar Pucuk Singkong (ABPS)

**Versi:** 3.0
**Tanggal:** 6 November 2026
**Status:** Draft desain — menggantikan PRD CRM Relawan Nusantara di repo boilerplate dan mengoreksi PRD HRD v2.2
**Produk:** ERP HRD, fokus awal absensi dan payroll IPA
**Lembaga:** satu profil lembaga (`org_profile`), bukan multi-tenant
**Acuan lapangan:** `CHANGELOG-analisa.md` (sheet, slip, jadwal, bonus outlet)
**Acuan narasi:** Google Doc *Erp abs stok* (`1u3IGxp7RthEjcdHZTlLn_Tb6JYVmPYmpoc7LrIW0FrY`, tab `t.0`)
**Acuan teknis yang tidak didesain ulang:** `refs/trd.md` dan kode boilerplate saat ini

Dokumen ini memakai Bahasa Indonesia. Angka yang disebut "contoh" bukan konstanta global. Label **Wajib** tidak boleh dimatikan oleh satu saklar lembaga. Label **Default** boleh diubah per scope dan per tanggal.

Nama pribadi, NIK, KK, nomor HP, dan rekening tidak ditulis di dokumen ini. Screening kasbon dilakukan `superadmin`.

Fragmen terakhir dokumen sumber yang hanya berisi kata "Januari" tidak ditafsirkan.

---

## Daftar Isi

1. [Latar belakang](#1-latar-belakang)
2. [Cara membaca aturan](#2-cara-membaca-aturan)
3. [Prinsip produk](#3-prinsip-produk)
4. [Ruang lingkup](#4-ruang-lingkup)
5. [Lembaga, peran, menu, dan isolasi](#5-lembaga-peran-menu-dan-isolasi)
6. [Unit kerja dan kelompok gaji](#6-unit-kerja-dan-kelompok-gaji)
7. [Presensi](#7-presensi)
8. [Jadwal shift](#8-jadwal-shift)
9. [Payroll](#9-payroll)
10. [Kasbon](#10-kasbon)
11. [Bonus](#11-bonus)
12. [Kontrak kerja](#12-kontrak-kerja)
13. [Slip, laporan, dan dasbor](#13-slip-laporan-dan-dasbor)
14. [Perbedaan sheet dan dokumen](#14-perbedaan-sheet-dan-dokumen)
15. [Pengaturan dinamis dan persetujuan](#15-pengaturan-dinamis-dan-persetujuan)
16. [User story dan kriteria terima](#16-user-story-dan-kriteria-terima)
17. [Roadmap stok dan HPP](#17-roadmap-stok-dan-hpp)
18. [Asumsi yang tetap terbuka](#18-asumsi-yang-tetap-terbuka)

---

## 1. Latar belakang

Boilerplate repo ini berasal dari CRM donatur. Aplikasi yang akan dibangun di atasnya adalah ERP HRD untuk Ayam Bakar Pucuk Singkong. Fokus rilis awal adalah absensi dan payroll IPA: jadwal, kehadiran, izin, lembur, kasbon, bonus, dan slip. Modul stok, pembelian, dan HPP disebut di dokumen *Erp abs stok*, tetapi belum masuk ruang lingkup rilis ini.

Operasi lapangan masih memakai sheet. Dapur pusat produksi dihitung mingguan. Outlet dan sebagian kantor dihitung bulanan. Aturan berubah menurut tanggal, dan dokumen narasi November 2026 tidak selalu sama dengan sheet. Karena itu sistem tidak menyimpan satu rumus global. Setiap perbedaan menjadi pengaturan pada scope yang tepat, dengan sumber tercatat.

PRD HRD v2.2 memperlakukan sebagian praktik sheet sebagai aturan produk, termasuk payday tanggal 3 dan jam hitung dapur yang dijepit pukul 05:00. Versi 3.0 memperbaiki hal itu. Praktik sheet tetap tersedia sebagai profil scope. Narasi dokumen menjadi default scope yang disebutkannya, bukan menimpa scope lain.

---

## 2. Cara membaca aturan

| Label | Arti |
|---|---|
| **Wajib** | Batas produk. Tidak ada satu nilai lembaga yang boleh menabrak batas ini. |
| **Default** | Nilai awal seed. Berlaku sampai ada override scope yang tanggalnya mencakup hari acuan. |
| **Contoh** | Angka di dokumen atau sheet untuk menjelaskan bentuk aturan. Bukan nilai semua orang dan bukan konstanta kode. |
| **Sumber** | `sheet`, `doc_erp_abs_stok`, `wa_bonus_outlet`, atau `manual`. Wajib tersimpan bersama nilai. |

Urutan override, dari yang menang:

`karyawan` → `jabatan` → `lokasi` → `kelompok gaji` → `lembaga` → default definisi

**Wajib:** dapur dan outlet tidak berbagi satu baris pay rule. Mengaktifkan denda telat di outlet tidak mengaktifkannya di dapur.

Tanggal acuan harian adalah tanggal presensi. Tanggal acuan payroll adalah `period_end` run. Run yang sudah `approved` membaca snapshot, bukan pengaturan hidup.

---

## 3. Prinsip produk

### P1 — Satu lembaga, identitas tersimpan

**Wajib.** Aplikasi tetap satu baris `org_profile` (`id = 1`). Nama, nama singkat, tagline, logo, favicon, dan warna diubah dari layar pengaturan lembaga. Seed tidak menimpa baris yang sudah `is_seed_default = false`.

### P2 — Akses tetap lewat pengguna sistem

**Wajib.** Login, peran, dan token tetap di `users` dan `user_tokens`. Karyawan yang tidak punya akun tidak login. Hak akses tidak dipindah ke tabel peran baru.

### P3 — Aturan bisnis ber-scope dan ber-versi

**Wajib.** Angka, toggle, dan metode payroll serta absensi dibaca dari registry pengaturan. Kode tidak menyimpan Rp500, Rp50.000, Rp4.000.000, pembagi 26, atau pukul 05:00 sebagai konstanta bisnis.

### P4 — Dua sumber tidak dijadikan satu rumus

**Wajib.** Jika sheet dan dokumen berbeda, keduanya disimpan sebagai nilai pada scope masing-masing plus `source_ref`. Tidak dipilih diam-diam menjadi aturan semua orang.

### P5 — Jejak tidak bisa diubah

**Wajib.** `audit_logs` dan jejak pengaturan hanya menerima sisipan. Koreksi presensi, perubahan aturan, persetujuan, dan penolakan tercatat.

### P6 — Pola aplikasi boilerplate tidak ikut didesain ulang

Halaman, route, dan SQL mengikuti guide `refs/trd.md`. Dokumen produk ini tidak memindahkan folder dan tidak mengganti pola handler.

---

## 4. Ruang lingkup

### 4.1 Masuk rilis awal

- Profil lembaga dan akun `superadmin` pada deployment.
- Master lokasi, jabatan, kelompok gaji, dan karyawan tanpa data pribadi di seed.
- Jadwal shift outlet P1, P2, Middle, Shift 3, jam custom, station, dan shift backup.
- Jadwal dapur mingguan dan jadwal office hour bulanan untuk tim dapur yang bukan crew jam-jaman.
- Presensi, termasuk catat backdate oleh `superadmin`.
- Izin dan sakit. Tidak ada saldo cuti tahunan pada default.
- Lembur per jam, tarifnya per kelompok atau per orang.
- Payroll mingguan dan bulanan, slip, serta rekap.
- Kasbon dengan cicilan yang diminta karyawan dan dipotong otomatis.
- Bonus outlet berdasarkan omset, dan bonus bulanan berkomponen. Keduanya terpisah.
- Komponen kompensasi per karyawan.
- Kontrak bertahap dan pengingat menjelang akhir.
- Registry aturan, persetujuan, dan snapshot run.

### 4.2 Di luar rilis awal

- Modul stok, pembelian, gudang, distribusi, HPP, harga jual, dan hutang vendor. Ringkasannya ada di [bagian 17](#17-roadmap-stok-dan-hpp).
- Pembayaran bank otomatis.
- Tarik omset otomatis dari MOKA, Runchise, atau Kledo. **Default** sumber omset = input manual.
- BPJS dan PPh21. **Default** mati. Komponennya ada, tetapi tidak dihitung sampai diaktifkan per scope.
- Chrome extension WhatsApp dan entitas CRM donatur.
- Cuti berbayar berbasis saldo.

---

## 5. Lembaga, peran, menu, dan isolasi

### 5.1 Identitas lembaga

**Wajib** memakai kolom `org_profile` yang sudah ada. Satu deployment memakai satu baris `id = 1`. Tidak ada tabel organisasi tambahan.

| Kolom | Pemakaian ERP |
|---|---|
| `nama` | Nama tampilan. **Default data** setelah lembaga disetel: Ayam Bakar Pucuk Singkong |
| `nama_singkat` | Singkatan. **Default data:** ABPS |
| `tagline` | Kalimat pendek aplikasi |
| `logo_url`, `favicon_url` | Berkas logo dan ikon |
| `primary_color`, `sidebar_color`, `accent_color` | Warna hex. Default kolom boilerplate `#01665a` / `#2e8b7a` sampai superadmin menyimpan warna lembaga |
| `is_seed_default` | `true` hanya pada seed awal |

Warna hijau dan emas prototipe bukan default skema. Superadmin menyimpannya lewat menu Pengaturan lembaga.

Teks slip dan penandatangan **bukan** kolom `org_profile`. Keduanya pengaturan: **Default** judul slip `SLIP GAJI KARYAWAN AYAM BAKAR PUCUK SINGKONG`, penandatangan `HR PUCUK SINGKONG`, sumber sheet.

### 5.2 Tiga peran

**Wajib.** `users.role` hanya berisi tiga label:

| Kode | Sebutan | Lapisan |
|---|---|---|
| `superadmin` | Pengelola deployment | Tidak punya atasan. Boleh tanpa baris karyawan |
| `superordinat` | Atasan | Satu lapisan di atas bawahan langsung |
| `subordinat` | Bawahan | Tidak melihat rekan |

Tidak ada peran `admin`, `supervisor`, `read_only`, `data_analyst`, atau `tim_blast` pada kontrak ini. Tidak ada tabel `custom_roles` dan tidak ada klaim peran dinamis. Label lama, bila masih ada di database, dipetakan sekali lewat migrasi di ERD, bukan dibiarkan hidup berdampingan.

Pengecekan tetap `checkPermission(role, resource, action)` di `lib/auth/rbac.ts`. Menyembunyikan menu bukan izin. Setiap query daftar dan detail menolak baris di luar ruang data peran itu.

Aksi sensitif (ubah lembaga, ubah aturan ber-floor, setujui payroll, screening kasbon, koreksi backdate) hanya `superadmin`, dan tetap mengikuti kebijakan persetujuan yang sudah ada.

Karyawan tanpa akun tidak login. `employees.user_id` kosong dan `has_login` false.

### 5.3 Kepemilikan

| Pemilik | Yang dimiliki |
|---|---|
| `superadmin` | Seluruh lokasi, tim, karyawan, run payroll, aturan, dan pengguna pada deployment ini |
| `superordinat` | Diri sendiri ditambah karyawan yang `supervisor_employee_id` menunjuk ke dirinya. Lokasi dan tim yang terlihat hanya lokasi dan jabatan orang-orang itu |
| `subordinat` | Satu baris karyawan miliknya: profil, jadwal, absensi, slip, kasbon, dan kontrak yang `employee_id`-nya sama dengan akunnya |

Satu karyawan punya paling banyak satu atasan. Tidak ada atasan-dari-atasan. `superadmin` boleh tidak punya atasan dan boleh tidak punya baris karyawan.

### 5.4 Siapa melakukan apa

| Aksi | superadmin | superordinat | subordinat |
|---|---|---|---|
| Baca data | Semua lokasi dan tim di deployment | Diri dan bawahan langsung | Diri sendiri |
| Buat master, pengguna, aturan | Ya | Tidak | Tidak |
| Ubah komponen upah dan run payroll | Ya | Tidak | Tidak |
| Setujui payroll, aturan ber-floor, screening kasbon, backdate | Ya | Tidak | Tidak |
| Ubah jadwal bawahan langsung | Ya | Ya | Tidak |
| Setujui izin dan tukar shift bawahan langsung | Ya | Ya | Tidak |
| Ajukan izin, tukar shift, kasbon | Jika akun itu juga karyawan, untuk dirinya | Untuk dirinya | Untuk dirinya |
| Clock-in | Jika akun itu juga karyawan | Untuk dirinya | Untuk dirinya |
| Lihat slip | Semua orang | Diri dan bawahan langsung | Diri sendiri |

`superordinat` tidak membuka tim atasan lain. `subordinat` tidak membuka rekan satu shift.

### 5.5 Menu

Menu berikut hanya modul yang sudah ada di PRD ini. Tidak ada menu stok.

1. Dasbor
2. Presensi: clock-in, rekap, koreksi backdate
3. Jadwal: kalender, template shift, tukar shift
4. Karyawan: daftar, komponen kompensasi
5. Payroll: run, slip
6. Kasbon: pengajuan, screening
7. Bonus: omset outlet, bonus bulanan
8. Kontrak: katalog tahap, kontrak orang
9. Laporan: kehadiran, payroll
10. Master: lokasi, jabatan, kelompok gaji, komponen, hari libur
11. Pengaturan: lembaga, aturan, pengguna
12. Persetujuan: kotak, kebijakan

Huruf pada matriks: R baca, C buat, U ubah, A setujui. Titik berarti menu tidak ditampilkan. Izin tetap dicek di server untuk tiap huruf.

| Menu | Submenu | superadmin | superordinat | subordinat |
|---|---|---|---|---|
| Dasbor | Ringkasan | R | R tim langsung | R diri |
| Presensi | Clock-in | RCU diri, bila punya karyawan | RCU diri | RCU diri |
| Presensi | Rekap | R | R tim langsung | R diri |
| Presensi | Backdate | RCUA | . | . |
| Jadwal | Kalender | RCU | RCU tim langsung | R diri |
| Jadwal | Template | RCU | R | . |
| Jadwal | Tukar shift | RCUA | RCUA tim langsung | RC milik sendiri |
| Karyawan | Daftar | RCU | R tim langsung | R diri |
| Karyawan | Komponen upah | RCU | R tim langsung | R diri |
| Payroll | Run | RCUA | R tim langsung | . |
| Payroll | Slip | R | R diri dan bawahan | R diri |
| Kasbon | Pengajuan | RCU semua | RC diri, R bawahan | RC diri |
| Kasbon | Screening | RCUA | . | . |
| Bonus | Omset outlet | RCUA | . | . |
| Bonus | Bonus bulanan | RCUA | R bagian diri dan bawahan | R bagian diri |
| Kontrak | Katalog tahap | RCU | R | . |
| Kontrak | Kontrak orang | RCU | R tim langsung | R diri |
| Laporan | Kehadiran | R | R tim langsung | R diri |
| Laporan | Payroll | R | R tim langsung | R diri |
| Master | Lokasi, jabatan, kelompok, komponen, libur | RCU | R | . |
| Pengaturan | Lembaga | RCU | . | . |
| Pengaturan | Aturan | RCUA | . | . |
| Pengaturan | Pengguna | RCU | . | . |
| Persetujuan | Kotak | RCUA | RA untuk izin dan tukar shift bawahan | R status milik sendiri |
| Persetujuan | Kebijakan | RCUA | . | . |

---

## 6. Unit kerja dan kelompok gaji

**Wajib:** pay rule dapur dan pay rule outlet disimpan terpisah.

| Kelompok | Siapa | Frekuensi | Periode | Payday default | Telat |
|---|---|---|---|---|---|
| `WEEKLY_DAPUR` | Crew dapur yang diupah per jam | Mingguan | Sabtu–Jumat | Akhir periode mingguan | **Wajib** mode `none` pada scope ini |
| `MONTHLY_DAPUR_OFFICE` | Tim dapur yang gajinya bulanan office hour | Bulanan | Tanggal 1 sampai akhir bulan | Tanggal 1 | **Wajib** mode `none` pada scope ini |
| `MONTHLY_OUTLET` | Crew outlet | Bulanan | Tanggal 1 sampai akhir bulan | Tanggal 1 | **Default** tidak aktif di tingkat lembaga. Kelompok ini boleh mengaktifkan denda per menit |
| `MONTHLY_KANTOR` | Admin, admin medsos, CS, purchasing, manager operasional | Bulanan | Tanggal 1 sampai akhir bulan | Tanggal 1 | Hanya jika scope jabatan atau orang mengaktifkannya |
| `PART_TIME` | Kerja kunjungan | Bulanan | Tanggal 1 sampai akhir bulan | Tanggal 1 | Mengikuti scope orang |

Lokasi awal: Outlet Baros dan Dapur Pusat. Koordinat kosong sampai diisi. **Default** pemetaan kantor terhadap dapur = lokasi yang sama, dan boleh diubah. Office hour dapur bukan lokasi baru; itu kelompok gaji sendiri.

Tanda "payday" tanggal 3 pada jadwal sheet **bukan** default tanggal gaji. Lihat [bagian 14](#14-perbedaan-sheet-dan-dokumen).

---

## 7. Presensi

### 7.1 Clock-in dan clock-out

1. Pengguna yang terhubung ke karyawan membuka presensi.
2. Sistem menyimpan waktu, koordinat, akurasi, dan foto bila lokasi mewajibkannya.
3. Di dalam radius, status masuk `valid`. Di luar radius, alasan wajib bila lokasi mengizinkan.
4. GPS palsu **default** ditolak.
5. Menit telat dihitung hanya jika aturan scope karyawan pada tanggal itu mengaktifkan denda atau penalti jadwal. Jika mode telat `none`, menit telat payroll = 0. Jam aktual tetap tersimpan.

**Default** radius 100 meter. **Default** foto aktif. Keduanya per lokasi.

### 7.2 Backdate

**Wajib.** Kehadiran yang lupa atau dicatat mundur hanya boleh diisi `superadmin` dengan alasan. Jejak menulis `audit_logs` (`entity_type = attendance`). `superordinat` dan `subordinat` tidak mengisi backdate.

### 7.3 Jam yang dibayar, dapur mingguan

Dokumen *Erp abs stok* menetapkan upah crew dapur dari jam masuk dan jam pulang aktual dikali tarif per jam. Sheet menjepit jam hitung ke pukul 05:00 dan memberi insentif bila masuk lebih awal.

**Default scope `WEEKLY_DAPUR`:** `weekly.total_hours_basis = raw_clock_in`. Sumber: dokumen. Tidak ada jepitan 05:00.

**Bukan default global.** Jepitan `counted_clock_in` pukul 05:00 plus insentif datang lebih awal tetap ada sebagai opsi. `superadmin` mengaktifkannya hanya pada scope karyawan atau jabatan yang memang masih memakai sheet. Sumber opsi itu: sheet.

Override per karyawan atau per jabatan menang atas kelompok, sesuai urutan di bagian 2.

### 7.4 Denda telat

**Wajib di tingkat lembaga:** `attendance.late_deduction_mode = none`.

Kelompok, jabatan, atau karyawan mengaktifkan `per_minute`, `prorata_hourly`, `per_hour`, `flat_cut`, atau `tiered` bila praktiknya memang memotong.

**Default scope `MONTHLY_OUTLET`, sumber sheet, hanya jika `superadmin` menyalakan profil sheet outlet:** toleransi 0 menit dan contoh Rp500 per menit. Nilai itu tidak menyebar ke dapur, ke office hour dapur, atau ke shift backup.

**Default scope kantor pada sheet lama** adalah prorata gaji ÷ 26 ÷ 9. Itu profil sheet, bukan default dokumen. Dokumen hanya mengatakan denda per menit ada untuk bulanan yang mengaktifkannya. Sebelum kelompok kantor diaktifkan, modenya `none`.

---

## 8. Jadwal shift

### 8.1 Template outlet

Jam buka lapangan 07:00–21:00. Template berikut adalah **default master**, dan jamnya boleh diganti dengan template baru. Template lama tidak diubah supaya riwayat tetap utuh.

| Kode | Nama | Jam default |
|---|---|---|
| `P1` | Shift 1 / pagi | 06:00–16:00 |
| `P2` | Shift 2 / siang | 11:30–21:30 |
| `MID` | Middle | 09:30–19:30 |
| `S3` | Shift 3 | 12:30–21:30 |
| `CUSTOM` | Jam khusus hari itu | diisi per penugasan |

Varian Shift 3 pukul 11:30 juga muncul di sheet. Itu template atau penugasan lain, bukan alasan mengubah `S3` yang sudah terpakai.

Station per hari: `ck` checker, `kit` kitchen, `ks` kasir, `se` server, `bk` bakar. Status hari: `work`, `off`, `off_izin`, `off_sakit`.

Tampilan jadwal outlet adalah grid bulanan, baris karyawan dan kolom tanggal.

### 8.2 Dapur

Crew `WEEKLY_DAPUR` tidak memakai P1/P2/Middle/S3. Mereka punya template kerja dapur. Office hour `MONTHLY_DAPUR_OFFICE` punya template sendiri dan **wajib** tanpa denda telat.

### 8.3 Backup

**Wajib.** Shift yang bertipe `backup` tidak menjalankan aturan telat. Menit telat payroll = 0. Jam masuk dan pulang tetap disimpan bila orang itu absen.

Tukar shift outlet tetap membutuhkan pengganti dan konfirmasi `superordinat` bawahan itu, atau `superadmin`. Pengganti yang masuk sebagai backup tidak terkena denda telat pada shift itu.

### 8.4 Izin

**Default** pengajuan izin atau sakit paling lambat malam sebelumnya atau 6 jam sebelum shift. Lewat dari itu ditandai, tanpa sanksi rupiah sampai scope menyalakannya. Surat sakit boleh menyusul H+1. Tidak ada saldo cuti pada default.

---

## 9. Payroll

### 9.1 Run

Satu run milik satu kelompok gaji dan satu rentang tanggal. Status: `draft` → `calculated` → `reviewed` → `approved` → `paid`.

**Wajib** setelah `approved`: snapshot aturan dan komponen dibekukan. Perubahan pengaturan tidak menghitung ulang run itu. Koreksi periode tertutup memakai run penyesuaian.

### 9.2 Crew dapur mingguan

**Default scope `WEEKLY_DAPUR`, sumber dokumen:**

- Upah hari = menit aktual antara masuk dan pulang ÷ 60 × tarif per jam karyawan itu.
- Tarif per jam disimpan per orang, bukan satu tarif dapur.
- Potongan utama pada slip adalah kasbon.
- Tidak ada potongan telat.

Profil sheet yang boleh di-override per orang atau jabatan, dan tidak aktif sebagai default kelompok:

- Tarif jam = gaji harian ÷ 9, atau tarif jam langsung.
- Jepitan pukul 05:00 dan insentif masuk lebih awal.
- Hari tertentu dibayar flat sebesar gaji harian.
- Lembur di atas 9 jam, sisa ≤ 30 menit diabaikan, sisanya dibulatkan ke atas per jam × tarif lembur flat.
- Insentif tanggal merah.
- Baris terpisah untuk jam hari Minggu.

**Contoh** nominal sheet (bukan seed orang): beberapa tarif jam dan lembur flat Rp10.000. Angka disimpan di komponen atau pengaturan scope bila `superadmin` mengaktifkan profil sheet.

Freelance dapur, bila masih ada, memakai tarif jam per orang ditambah borongan per satuan. Tarif borongan berversi tanggal. **Contoh** sheet tidak disalin sebagai nilai semua pekerja borongan.

### 9.3 Tim dapur bulanan office hour

**Wajib** terpisah dari crew mingguan dan **wajib** tanpa denda telat. Periode dan payday mengikuti default bulanan: tanggal 1 sampai akhir bulan, gajian tanggal 1.

### 9.4 Komponen per orang

**Wajib.** Nilai gapok, tunjangan, tarif jam, dan tarif harian ada di komponen karyawan yang berversi tanggal. Jabatan hanya menentukan komponen mana yang tersedia, bukan nominalnya.

| Peran kerja | Komponen yang tersedia | Nilai |
|---|---|---|
| Crew dapur jam-jaman | tarif per jam | per orang |
| Manager dapur | gaji pokok dan tarif per hari, tanpa denda telat | **Contoh dokumen:** pokok Rp2.000.000 dan Rp100.000 per hari. Bukan default jabatan |
| Admin | gaji pokok + tunjangan kehadiran | per orang |
| Admin medsos | gaji pokok + tunjangan kehadiran | per orang |
| CS | gaji pokok + bonus | per orang; rumus bonus tidak diisi dari tebakan |
| Outlet dan kantor pada profil sheet | pokok, tunjangan tidak tetap, tunjangan jabatan menurut pecahan jabatan | pecahan sheet adalah template jabatan, nominal tetap per orang |

**Default dokumen untuk yang bulanan:** ada gaji pokok, tunjangan kehadiran, tunjangan transport, dan lembur dihitung per jam. Template sheet 50/50, 50/30/20, 60/40, dan 60/25/15 tetap bisa dipilih per jabatan. Keduanya tidak berlaku sekaligus untuk orang yang sama. Yang menang adalah komponen aktif pada tanggal acuan.

Pembagi hari **default** 26 dan pembagi jam **default** 9 hanya dipakai metode yang memang memilih prorata. Metode aktual per jam tidak memakai pembagi itu.

### 9.5 Lembur bulanan

**Default** mode `flat_per_hour` per kelompok. **Contoh** sheet: crew outlet Rp10.000 per jam dengan pecahan 0,5 jam; kantor Rp17.000 per jam. Keduanya pengaturan scope, bukan tarif lembaga.

### 9.6 Tanggal merah

**Default scope bulanan, sumber dokumen:** tanggal merah selain Minggu menambah insentif. **Contoh** nominal Rp50.000. Minggu tidak ikut insentif ini pada default bulanan.

**Default scope `WEEKLY_DAPUR`:** insentif tanggal merah tidak menyala otomatis dari aturan bulanan. Profil sheet punya insentifnya sendiri dan kebijakan Minggu sendiri, dan hanya aktif bila scope dapur menyalakannya.

### 9.7 Potongan izin, sakit, dan libur

Profil sheet (sumber sheet, tidak dipakai kelompok yang modenya `none`):

- Izin crew: hari × gaji ÷ 26. Izin kantor: hari × tunjangan ÷ 26.
- Sakit crew: hari × tunjangan ÷ 26. Sakit kantor: **contoh** Rp50.000 per hari.
- Maret sempat memakai angka harian lain. Karena itu setiap angka punya `effective_from`.
- Libur operasional dapat dibayar sebagian. **Contoh** sheet Lebaran 50%. Fitur **default** mati sampai diaktifkan pada rentang tanggal.

---

## 10. Kasbon

**Wajib** alurnya seperti dokumen, nominal dan interval **default** yang bisa diubah:

1. Karyawan mengajukan kasbon dan memilih berapa kali potongan serta besar tiap cicilan.
2. Interval cicilan: `weekly`, `monthly`, atau `custom`.
3. `superadmin` melakukan screening dokumen. Sebelum lolos, kasbon tidak memotong gaji.
4. Setelah lolos, tiap run gajian kelompok karyawan itu memotong otomatis sebesar cicilan yang disepakati, sampai sisa nol.
5. Slip menampilkan potongan kasbon. Untuk dapur mingguan, inilah pengurang utama.
6. Pelunasan tercatat per run. Perubahan jadwal cicilan membuat versi baru dan jejak audit.

Sumber uang kasbon boleh dicatat (kas outlet, kas besar, atau sumber lain). Nama pemberi uang pribadi tidak dijadikan data master.

---

## 11. Bonus

Ada dua keluarga bonus. **Wajib** tidak digabung menjadi satu rumus.

### 11.1 Bonus omset outlet

Sumber: pengumuman lapangan yang dirangkum changelog, bukan dokumen *Erp abs stok*.

**Default contoh** bila profil outlet dinyalakan:

| Omset bersih | Persen |
|---|---|
| Di bawah Rp350.000.000 | 0% |
| Rp350.000.000 sampai Rp400.000.000 | 0,5% |
| Di atas Rp400.000.000 | 1% |

Omset bersih **default** = kotor − diskon − potongan ojol. Headcount referensi 12 tidak mengubah persen pada default (`ignore`). Metode bagi **default** `manual`. Opsi lain: rata, hari hadir, bobot jabatan, hadir × bobot, atau nominal tetap dengan penalti izin/sakit.

Bonus catering adalah fitur terpisah. **Default** mati sampai penerima dan basis omsetnya diisi. Changelog hanya memberi asumsi, bukan keputusan.

### 11.2 Bonus bulanan berkomponen

Sumber: dokumen *Erp abs stok*. Ini bukan persen omset.

Bentuknya, semua angka dan toggle dinamis:

- Nominal pool diisi per periode. **Contoh dokumen:** Rp4.000.000.
- Komponen tanpa telat. **Contoh:** Rp100.000. Karyawan masih menerima komponen ini bila total menit telat periode **di bawah** ambang. **Contoh ambang:** 5 menit, pembanding `lt` (di bawah, bukan kurang dari atau sama dengan).
- Komponen tanpa izin. **Contoh:** Rp100.000 bila tidak ada izin pada periode.
- Sisa pool setelah komponen tetap yang terbayar dibagi rata.

**Wajib sebelum skema dihitung:** `superadmin` mengisi siapa yang masuk pembagian sisa. Dokumen tidak menetapkan populasinya. Pilihan yang tersedia: semua anggota kelompok, hanya yang menerima salah satu komponen, atau daftar manual. Tidak ada default diam-diam.

Sakit tidak menggugurkan komponen "tanpa izin" kecuali toggle scope menyatakannya. **Default** toggle itu mati.

### 11.3 Bonus capaian

Dokumen menyebut nama "bonus capaian" tanpa rumus. Katalog boleh punya jenis ini. **Default** nonaktif dan tidak menghasilkan angka sampai `superadmin` menyimpan rumusnya.

---

## 12. Kontrak kerja

**Default** katalog durasi, bukan urutan paksa untuk setiap orang:

| Kode | Durasi |
|---|---|
| `training_1m` | 1 bulan |
| `training_3m` | 3 bulan |
| `contract_1y` | 1 tahun |

`superadmin` menyusun tahapan per karyawan. Sistem menyimpan tanggal mulai, tanggal selesai, dan menghitung masa kerja dari tanggal masuk sampai tanggal selesai atau hari ini bila masih berjalan.

**Wajib** ada pengingat menjelang akhir kontrak yang masih aktif. Jumlah hari pengingat **belum ada di dokumen**. Kolomnya kosong sampai `superadmin` mengisi. Pengingat tidak dikirim selama hari itu kosong.

---

## 13. Slip, laporan, dan dasbor

Slip mingguan menampilkan harian: masuk, pulang, jam yang dibayar menurut basis scope, upah, lembur, insentif, penambahan, kasbon, dan bersih.

Slip bulanan menampilkan komponen yang aktif pada orang itu: pokok, tunjangan kehadiran, transport, jabatan bila ada, lembur per jam, bonus, tanggal merah, lalu potongan yang benar-benar aktif (telat hanya jika mode scope bukan `none`, izin, sakit, kasbon, gantungan bila fitur hidup).

Slip tidak mencetak NIK atau nomor rekening.

Dasbor awal: hadir hari ini per lokasi, run terbuka, kasbon belum lunas, kontrak yang tanggal pengingatnya sudah diisi dan sudah jatuh tempo. Tidak ada kartu stok.

Ekspor Excel mengikuti pola ekspor yang sudah ada di aplikasi.

---

## 14. Perbedaan sheet dan dokumen

Tabel ini adalah konfigurasi, bukan dua kebijakan yang sama-sama global. Seed menyimpan nilai pada scope di kolom "Disimpan sebagai", dengan `source_ref` sesuai sumber.

| Topik | Sheet (changelog) | Dokumen *Erp abs stok* | Disimpan sebagai | Label |
|---|---|---|---|---|
| Jam bayar crew dapur | Jepitan 05:00, insentif bila lebih awal | Masuk dan pulang aktual × tarif jam | Default `WEEKLY_DAPUR` = aktual. Jepitan 05:00 = opsi override, tidak aktif di tingkat lembaga | Default vs opsi |
| Potongan dapur | Tidak memotong telat; upah dari jam | Tidak ada denda telat; pengurang utama kasbon | `WEEKLY_DAPUR.late = none` | **Wajib** untuk scope dapur |
| Denda telat bulanan | Crew Rp500/menit; kantor prorata | Hanya kelompok yang menyalakan denda per menit | Lembaga = `none`. Outlet/kantor punya profil sheet yang harus dinyalakan eksplisit | **Wajib** lembaga; profil = Default nonaktif |
| Payday bulanan | Tanda jadwal tanggal 3 dipakai asumsi lama | Periode 1–akhir bulan, gajian tanggal 1 | Default kelompok bulanan = tanggal 1. Tanggal 3 bukan payday | Default dokumen mengoreksi asumsi lama |
| Tanggal merah | Rp50.000 pada praktik dapur mingguan | Bulanan, selain Minggu, contoh Rp50.000 | Dua scope. Jangan salin saklar bulanan ke mingguan | Default per kelompok |
| Bonus | Persen omset outlet | Pool contoh Rp4.000.000, komponen Rp100.000 + Rp100.000, sisa dibagi rata, ambang telat di bawah 5 menit | Dua kunci: `bonus.outlet.*` dan `bonus.monthly.*` | Contoh, bukan konstanta |
| Komponen bulanan | Pecahan persen per jabatan | Pokok + tunjangan kehadiran + transport + lembur per jam | Komponen per orang. Pecahan sheet = template jabatan | Default struktur dokumen |
| Manager dapur | Tidak ditetapkan sebagai pokok + harian | Contoh pokok Rp2.000.000 + Rp100.000/hari, tanpa telat | Contoh komponen satu orang, scope karyawan, tidak di-seed ke jabatan | Contoh |
| Admin, medsos, CS | Pecahan sheet kantor | Admin dan medsos: pokok + tunjangan kehadiran. CS: plus bonus | Ketersediaan komponen per jabatan, nominal per orang | **Wajib** per orang |
| Crew dapur | Harian ÷ 9 atau tarif jam sheet | Tarif jam berbeda tiap orang | `hourly_rate` per karyawan pada `WEEKLY_DAPUR` | **Wajib** per orang |
| Office hour dapur | Tidak dipisah dari crew mingguan | Ada tim dapur bulanan tanpa denda telat | Kelompok `MONTHLY_DAPUR_OFFICE` | **Wajib** terpisah |
| Kasbon | Nominal dan cicilan opsional | Karyawan memilih kali dan besar cicilan; interval mingguan, bulanan, atau custom; screening `superadmin`; potong otomatis tiap gajian | Alur kasbon versi 3.0 | **Wajib** alur; angka = Default |
| Shift backup | Hanya lewat tukar shift | Tidak ada aturan telat | `shift.late_policy = none` untuk tipe backup | **Wajib** |
| Presensi lupa | Koreksi disebut di produk lama | `superadmin` mencatat backdate, ada audit | Izin `attendance.correct` hanya `superadmin` | **Wajib** |
| Stok dan HPP | Di luar HRD | Ada di dokumen yang sama | Roadmap bagian 17, tanpa tabel | **Wajib** di luar scope |

---

## 15. Pengaturan dinamis dan persetujuan

Layar pengaturan membaca registry. Kartu menampilkan nilai efektif, scope pemenang, sumber, dan tanggal berlaku. Mengubah nilai wajib mengisi alasan dan tanggal mulai. Tanggal mulai tidak boleh memotong run `approved`.

Preview menunjukkan selisih pada run yang masih draft atau calculated.

### 15.1 Kunci utama

| Kunci | Default | Scope | Sumber | Persetujuan awal |
|---|---|---|---|---|
| `attendance.late_deduction_mode` | `none` | lembaga, lalu kelompok | dokumen | Mati, audit saja. Menyalakan denda pada outlet boleh tanpa floor |
| `weekly.total_hours_basis` | `raw_clock_in` pada `WEEKLY_DAPUR` | kelompok, jabatan, karyawan | dokumen | Mati |
| `weekly.earliest_count_time` | tidak terpasang | jabatan, karyawan | sheet, hanya bila basis jepitan dipilih | Mati |
| `period.monthly_payday_day` | `1` | kelompok bulanan | dokumen | Mati |
| `period.weekly` | Sabtu–Jumat | `WEEKLY_DAPUR` | dokumen dan sheet, selaras | Mati |
| `holiday.monthly_incentive` | aktif, kecuali Minggu, contoh 50000 | kelompok bulanan | dokumen | Floor bila nominal diubah |
| `bonus.outlet.tiers` | contoh tier changelog | lokasi | wa / changelog | Floor |
| `bonus.monthly.*` | bentuk contoh bagian 11.2; populasi sisa wajib diisi | kelompok | dokumen | Floor |
| `feature.bpjs`, `feature.pph21` | mati | lembaga atau kelompok | changelog | Floor |
| `feature.salary_holdback` | mati | kelompok atau karyawan | sheet Maret, bukan dokumen | Floor |
| `kasbon.interval` | dipilih saat pengajuan | per kasbon | dokumen | Screening `superadmin` |
| `contract.remind_days` | kosong | lembaga | tidak ada di dokumen | Mati |
| `system.public_api` | mati terkunci | lembaga | keamanan | Tidak ada saklar UI |

Daftar Q-01 sampai Q-17 pada changelog tetap menjadi kunci yang tersedia. Bila default changelog bertentangan dengan tabel bagian 14, tabel bagian 14 yang dipakai.

### 15.2 Persetujuan

**Wajib** tidak ada self-approval. Kebijakan persetujuan sendiri membutuhkan dua pengguna `superadmin` yang berbeda. Bila baru ada satu `superadmin`, perubahan bertanda floor tidak bisa disetujui sampai pengguna kedua ada. Sistem menolak kebijakan yang mustahil disetujui.

Peran penyetuju hanya `superadmin` atau `superordinat` sesuai matriks menu. Dokumen lama yang menyebut "Owner" dibaca sebagai `superadmin`.

Item yang sudah `approved` pada payroll tidak dibuka kembali oleh perubahan kebijakan.

---

## 16. User story dan kriteria terima

| ID | Story |
|---|---|
| US-01 | Sebagai crew outlet, saya melihat jadwal sebulan: shift, station, dan status off. |
| US-02 | Sebagai crew outlet, saya clock-in dan melihat menit telat hanya bila kelompok saya memang memotong telat. |
| US-03 | Sebagai crew, saya menukar shift. Shift backup pengganti tidak menghasilkan denda telat. |
| US-04 | Sebagai superadmin, saya mengisi presensi yang lupa beserta alasan, dan jejaknya ada di audit. |
| US-05 | Sebagai crew dapur mingguan, slip saya memakai jam aktual × tarif saya, tanpa potongan telat, dengan kasbon bila ada. |
| US-06 | Sebagai superadmin, saya memberi satu crew dapur profil sheet 05:00 tanpa mengubah crew dapur yang lain. |
| US-07 | Sebagai karyawan bulanan, saya melihat pokok, tunjangan yang memang saya punya, lembur per jam, dan payday tanggal 1. |
| US-08 | Sebagai subordinat, saya mengajukan kasbon dengan jumlah cicilan dan interval, lalu superadmin men-screening sebelum ada potongan. |
| US-09 | Sebagai superadmin, saya menghitung bonus omset outlet dan bonus bulanan berkomponen sebagai dua proses. |
| US-10 | Sebagai superadmin, bonus bulanan menolak dihitung sebelum populasi sisa dipilih. |
| US-11 | Sebagai superadmin, saya menyusun kontrak 1 bulan, 3 bulan, lalu 1 tahun, dan sistem menyimpan awal, akhir, serta masa kerja. |
| US-12 | Sebagai superadmin, saya mengubah nama dan warna lembaga tanpa menyentuh aturan payroll. |

| Kriteria | Target |
|---|---|
| Scope dapur dan outlet | Mengubah denda outlet tidak mengubah slip dapur |
| Backup | `late_minutes` payroll = 0 |
| Backdate | Ditolak tanpa alasan atau tanpa peran `superadmin` |
| Payday | Kelompok bulanan default tanggal 1 |
| Jam dapur | Default aktual. Override 05:00 hanya pada scope yang dipilih |
| Contoh manager dapur | Tidak muncul sebagai nominal jabatan |
| Run approved | Hash snapshot tidak berubah setelah pengaturan diubah |
| Seed | Tidak berisi NIK, HP, rekening, atau nama pribadi |
| Stok | Tidak ada menu atau tabel stok pada rilis ini |
| API | Mutasi menolak tanpa izin `checkPermission` |

Paralel run dengan sheet hanya diwajibkan untuk scope yang profil sumbernya `sheet`. Scope yang sumbernya dokumen tidak dipaksa sama dengan sheet.

---

## 17. Roadmap stok dan HPP

Bagian ini hanya catatan fase berikut. **Wajib** tidak menghasilkan modul, menu, tabel, atau API pada rilis absensi dan payroll.

Dari dokumen *Erp abs stok*, alur yang ditunda:

- Rencana belanja bersumber dari dapur atau outlet, lalu diminta ke purchasing.
- Pembelian dicatat sekali lewat satu gudang.
- Barang masuk membawa jumlah, nilai, dan HPP all-in.
- Sebagian stok masuk gudang, sebagian masuk produksi. Contoh narasi: ayam ungkep masuk freezer dan nanti dipesan outlet atau dapur catering.
- Stok keluar dari dapur pusat ke outlet atau catering, beserta HPP keluar dan sisa stok.
- Harga jual dapur pusat ke outlet dan catering sudah termasuk margin.
- Uang yang diterima dapur perlu bisa ditelusuri dibelikan apa.
- Pembayaran ke vendor dilakukan setelah barang datang.
- Kebutuhan akuntansi yang disebut: HPP pemakaian catering dan outlet, serta apakah jual ke outlet dan catering untung, karena dapur pusat terindikasi merugi dan ke depan outlet bisa dimiliki pihak lain.

Tidak ada spesifikasi kuantitas, akun, atau harga di dokumen ini. Fase itu membutuhkan PRD-nya sendiri.

---

## 18. Asumsi yang tetap terbuka

Hal berikut sengaja tidak diisi:

- Jumlah hari pengingat kontrak.
- Siapa saja yang menerima sisa bonus bulanan.
- Rumus bonus capaian dan rumus bonus CS.
- Apakah sakit menggugurkan komponen tanpa izin.
- Koordinat lokasi.
- Apakah profil sheet 05:00 masih dipakai seorang crew tertentu.
- Nama badan hukum. Tampilan aplikasi memakai nama dagang sampai diisi di `org_profile`.
- Atasan langsung tiap karyawan. Kolomnya tidak ada di roster, jadi tidak diisi.
- Seed karyawan tidak aktif. Rincian field yang siap dan yang belum ada di `refs/seed-hrd.md`. Jumlah nama pada sheet `saat ini` bukan pernyataan bahwa seed sudah lengkap.

Sebelum butir itu diisi di pengaturan, fitur yang bergantung padanya tidak menghitung angka.
