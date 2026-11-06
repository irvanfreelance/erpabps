# CLAUDE.md — ERP HRD Ayam Bakar Pucuk Singkong

Absensi dan payroll IPA. Satu lembaga (`org_profile`). Bukan CRM donatur. Stok, pembelian, dan HPP di luar scope.

API serta UI HRD belum ada. Jangan menulis bahwa sistem siap production.

## Stack yang dipakai

- Next.js App Router, TypeScript, Tailwind, komponen yang sudah ada di `components/`
- PostgreSQL lewat `@neondatabase/serverless` untuk host Neon. URL Postgres lain pada skrip migrasi/seed memakai `pg`
- SQL mentah di `app/api/{model}/route.ts`. `logAudit` hanya di `lib/db/audit.ts`
- Drizzle tidak dipakai sebagai query builder. Migrasi yang dijalankan: `npm run db:migrate` membaca `lib/db/migrations/0000_init.sql`
- Seed: `npm run db:seed` membaca `refs/seed-hrd.json`

## Aturan yang tidak dilanggar

1. Parameter query tidak digabung dari string.
2. Halaman default Server Component. Data lewat `fromRoute`, bukan `fetch` ke origin sendiri, dan bukan SQL di halaman.
3. `"use client"` hanya bila ada event, hook, atau pustaka interaktif.
4. PK `BIGSERIAL`. Status `VARCHAR`. `audit_logs` hanya INSERT dan tidak punya kolom donatur.
5. Tiga peran: `superadmin`, `superordinat`, `subordinat`. Satu atasan atau NULL. Tidak ada peran `admin`, `supervisor`, `tim_blast`, `data_analyst`, atau `read_only`.
6. Setiap daftar memfilter di SQL. Menyembunyikan menu bukan izin.
7. Angka kalender, telat, lembur, bonus, dan jepitan jam datang dari `setting_values` (scope + tanggal). Run `approved`/`paid` memakai snapshot.
8. Jangan hardcode gaji seseorang ke jabatan. Jangan isi tanggal bergabung yang tidak ada di sumber.
9. Jangan menaruh NIK, HP, rekening, atau password di contoh, tes, atau log.

## Peran dan data

| Peran | Melihat |
|---|---|
| `superadmin` | Semua lokasi dan tim di deployment ini |
| `superordinat` | Diri dan bawahan langsung |
| `subordinat` | Profil, jadwal, absensi, slip, kasbon, dan kontrak sendiri |

`checkPermission` ada di `lib/auth/rbac.ts`. Matriks menu ada di `refs/prd.md` bagian 5.

## Domain yang berlaku

- Shift outlet: `P1`, `P2`, `MID`, `S3`. Shift `backup` tidak kena denda telat.
- Dapur mingguan default jam aktual. Jepitan 05:00 hanya override scope, bukan aturan semua orang.
- Payday bulanan default tanggal 1, lewat setting, bukan konstanta di calculator.
- Kelompok gaji terpisah. Denda telat lembaga default `none`.
- Kasbon: cicilan dari pengajuan, potong setelah screening `superadmin`.
- Kontrak: opsi 1 bulan, 3 bulan, 1 tahun. Hari pengingat kosong sampai diisi.

## Seed

Wajib environment `DATABASE_URL`. Akun superadmin hanya bila `ADMIN_EMAIL`, `ADMIN_NAME`, dan `ADMIN_PASSWORD` diisi. Tidak ada password default.

Hasil seed saat ini: 19 orang, 6 `active`, 13 `draft`, nol payroll run, semua `validation_required`. Lokasi "Outlet" belum FK. Atasan NULL. Ini data draf untuk dikembangkan, bukan go-live.

## Route baru

```
app/api/{resource}/route.ts
app/api/{resource}/[id]/route.ts
```

Isi: sesi, izin, Zod, SQL, audit, JSON. Soft delete dengan `deleted_at` bila master memang diarsipkan.

Jangan menambah `lib/db/queries/`. Jangan memindah folder di `refs/trd.md` bagian 2.

## Sisa yang bukan spesifikasi

Halaman dan route `/donors`, `/campaigns`, `/programs`, `/tags`, `/blast-batches`, dan impor CRM masih ter-compile. Tabelnya tidak ada. Jangan menambah fitur di sana. `npm run lint` masih gagal pada komponen UI lama.

Artefak `refs/crm_rn_app.jsx` dan `refs/crm_wa_extension.jsx` bukan acuan produk.
