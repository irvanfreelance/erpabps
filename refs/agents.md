# agents.md — ERP HRD Ayam Bakar Pucuk Singkong

Panduan agen untuk absensi dan payroll IPA. Pola folder dan kode yang sudah ada tidak dipindah. Domain donatur, program, campaign, tag, blast, dan segmen bukan pekerjaan ini.

Dokumen produk: `refs/prd.md`, `refs/erd.md`, `refs/trd.md`, `refs/claude.md`, `refs/seed-hrd.md`.

Stok, pembelian, gudang, dan HPP di luar scope. Jangan buat tabel atau menu untuk itu.

API dan UI HRD belum dibangun. Seed roster bukan tanda siap production.

---

## Agent: `db-engineer`

**Scope:** `lib/db/migrations/0000_init.sql`, `drizzle/schema.ts`, `drizzle/seed.ts`, `drizzle/migrate.ts`, `lib/db/index.ts`, `lib/db/audit.ts`. SQL produk baru tetap di `app/api/{model}/route.ts`, bukan di `lib/db/queries/`.

**Rules:**
1. Query memakai tagged template `@neondatabase/serverless`. Jangan menggabung string untuk nilai.
2. Drizzle ORM (`.select()`, `.insert()`) tidak dipakai di aplikasi. `drizzle/schema.ts` hanya cermin sebagian. DDL yang dijalankan adalah `lib/db/migrations/0000_init.sql` lewat `npm run db:migrate`.
3. `CREATE TABLE` HRD wajib `IF NOT EXISTS`. Jangan drop tabel HRD yang sudah berisi data.
4. Indeks parsial `WHERE deleted_at IS NULL` pada master yang soft-delete.
5. PK `BIGSERIAL`. Status `VARCHAR`, bukan ENUM database. Waktu `TIMESTAMPTZ`.
6. Angka bisnis (telat, payday, jepitan jam, lembur, bonus) dibaca dari `setting_values` menurut scope dan tanggal. Jangan hardcode ke jabatan atau ke kode.
7. Run `approved` atau `paid` membaca `payroll_run_snapshots`. Jangan hitung ulang.
8. `join_date` kosong tetap NULL. Jangan mengisi tanggal palsu. `record_status = active` hanya jika nomor, jabatan, kelompok gaji, dan tanggal bergabung ada.
9. `employees.supervisor_employee_id` satu nilai atau NULL. Tidak ada hierarki bertingkat.
10. `audit_logs` hanya INSERT. Tidak ada kolom donatur.

**Contoh tugas:** "Tambah pay rule per kelompok tanpa mengubah kelompok lain."

---

## Agent: `api-engineer`

**Scope:** `app/api/**/*.ts`, `lib/validators/*.ts`, `lib/auth/rbac.ts`, `lib/auth/session.ts`, `types/`.

**Rules:**
1. Pola route: `getServerSession()` → `checkPermission()` → Zod → SQL di file route itu → `logAudit()` → `NextResponse.json()`.
2. Tiga peran saja: `superadmin`, `superordinat`, `subordinat`. Jangan menambah peran keempat atau tabel `custom_roles`.
3. Isolasi ada di SQL, bukan di sembunyinya menu.
   - `superadmin`: seluruh lokasi dan tim pada deployment (`org_profile` satu baris).
   - `superordinat`: diri sendiri dan karyawan yang `supervisor_employee_id` menunjuk ke dia. Tidak lintas tim.
   - `subordinat`: hanya baris miliknya (profil, jadwal, absensi, slip, kasbon, kontrak).
4. Mutasi tercatat di `audit_logs`. Argumen `donorId` pada `logAudit` diabaikan.
5. Presensi backdate, screening kasbon, ubah lembaga, ubah aturan ber-floor, dan setujui payroll hanya `superadmin`, lewat `approval_policies` bila kebijakan itu aktif.
6. Shift `backup` memaksa menit telat payroll = 0.
7. Kasbon memotong gaji hanya setelah screening. Cicilan dan interval datang dari pengajuan, bukan konstanta.
8. Jangan mengembalikan NIK, rekening, atau nomor HP ke peran yang tidak berhak. Jangan menaruh data pribadi di contoh, seed, atau log tes.

**Contoh tugas:** "Route rekap absensi yang menolak rekan satu tim untuk subordinat."

---

## Agent: `fe-engineer`

**Scope:** `app/(dashboard)/**/*.tsx`, `components/**/*.tsx`, `hooks/*.ts`, `app/globals.css`.

**Rules:**
1. Server Component secara default. `"use client"` hanya untuk event, hook, atau pustaka interaktif.
2. Server Component memuat data lewat `fromRoute`. Jangan `fetch` ke URL `/api` sendiri. Jangan menulis SQL di halaman.
3. shadcn/ui, Lucide, `DataTable`, form Zod, `nuqs` untuk filter. Font dan warna mengikuti `org_profile`. Default kolom masih `#01665a` sampai lembaga disimpan.
4. Menu yang disembunyikan bukan pengaman. Tombol yang tidak berhak tetap harus ditolak server.
5. Halaman donatur, campaign, blast, dan tag yang masih ada adalah sisa. Jangan menambah fitur di sana. Menu target ada di `refs/prd.md` bagian 5, dan belum dipasang.
6. Slip dan daftar tidak menampilkan NIK atau rekening.

**Contoh tugas:** "Halaman jadwal bulanan P1, P2, Middle, dan Shift 3 untuk bawahan langsung."

---

## Agent: `import-engineer`

**Scope:** `drizzle/seed.ts`, `refs/seed-hrd.json`, `lib/utils/export-xlsx.ts`, dan nanti route impor yang mengikuti pola `app/api/{model}/route.ts`.

**Rules:**
1. Perintah yang berlaku: `npm run db:migrate` kemudian `npm run db:seed`.
2. Superadmin hanya terbentuk bila environment berisi `ADMIN_EMAIL`, `ADMIN_NAME`, dan `ADMIN_PASSWORD`. Tidak ada password bawaan di repo.
3. Roster 19 orang: 6 `active` dan ikut `in_payroll`, 13 `draft` dan tidak ikut payroll. Semua `validation_required`. Tidak ada `payroll_runs`.
4. Jangan menganggap seed lengkap atau siap production. API dan UI HRD belum ada. Nama yang tidak persis dengan payroll tidak digabung. Lokasi "Outlet" belum punya FK.
5. Impor berkas nanti memakai `exceljs` di route yang sama polanya dengan route lain. Jangan membuat pipeline kedua dan jangan menyalin NIK, KK, HP, atau rekening ke dokumen.

**Contoh tugas:** "Tolak impor baris tanpa tanggal bergabung alih-alih mengisi tanggal hari ini."

---

## Agent: `qa-engineer`

**Scope:** tes di sekitar route, validator, dan seed. Belum ada skrip `test` di `package.json`.

**Rules:**
1. Uji yang wajib saat API ada: subordinat tidak melihat rekan; superordinat tidak melihat tim lain; backup tidak memotong telat; draf tidak masuk run; run approved tidak berubah setelah setting diubah.
2. Jangan membuat fixture berisi NIK, HP, rekening, atau password sungguhan.
3. `npm run lint` masih gagal pada komponen UI lama. Jangan "memperbaiki" itu dengan menghapus halaman kecuali diminta.
4. Performa lama untuk pencarian donatur tidak dipakai.

**Contoh tugas:** "Dua karyawan draft tidak muncul di generate payroll."

---

## Urutan kerja

```
Sudah ada: migrasi 0000_init.sql dan seed roster draft/active
Berikutnya: API absensi, jadwal, kasbon, payroll, pengaturan
Sesudah API: halaman menu PRD bagian 5
Bukan sekarang: stok/HPP, extension WhatsApp, halaman donatur
```

## Resolusi

1. Aturan produk → `refs/prd.md`
2. Kolom dan relasi → `refs/erd.md` dan `lib/db/migrations/0000_init.sql`
3. Pola folder dan route → `refs/trd.md` bagian 2. Jangan membuat `lib/db/queries/` atau paket baru.
4. `refs/crm_rn_app.jsx` bukan spesifikasi.

Extension WhatsApp dan artefak CRM di `refs/` bukan backlog rilis ini.
