# Seed dokumen HRD

Berkas data: `refs/seed-hrd.json`.

`drizzle/seed.ts` membaca berkas JSON ini setelah migrasi `0004_hrd_domain.sql`. Perintahnya `npm run db:migrate` lalu `npm run db:seed`. Superadmin hanya dibuat bila `ADMIN_EMAIL`, `ADMIN_NAME`, dan `ADMIN_PASSWORD` ada di environment. Tidak ada password bawaan.

Orang tanpa field wajib masuk sebagai `draft` dengan kolom yang kosong dibiarkan NULL. Enam orang yang lengkap berstatus `active` dan `in_payroll`. Tidak ada `payroll_runs`. Semua baris `validation_required`. Ini belum siap production.

## Sumber

| Berkas unggahan | Sheet | Pemakaian |
|---|---|---|
| Roster master | `saat ini` | Daftar orang yang dianggap aktif. Sheet `planing` tidak dipakai sebagai roster aktif |
| Payroll bulanan | `SEPTEMBER` | ID dan posisi hanya bila nama cocok persis |
| Payroll mingguan | `10 Oktober - 16 Oktober` | ID, posisi `PRODUKSI`, dan tarif harian angka |

Empat berkas Excel tidak disalin ke repo.

## Field yang diikutkan dan yang dibuang

Diikutkan bila terisi di sumber: nama, label lokasi kolom A, frekuensi kolom B, jabatan kolom E, tanggal bergabung kolom D yang terurai, teks kompensasi kolom C apa adanya, ID payroll yang cocok persis.

Tidak diikutkan: NIK, KK, email, HP, tanggal lahir, alamat, rekening, dan password. Kolom itu ada di sheet `saat ini`, tetapi bukan field wajib seeder yang bisa dijalankan hari ini, dan tidak ditulis ke berkas seed.

Placeholder `superadmin` tidak punya email dan tidak punya `password_hash`.

## Siap dan belum siap

Wajib sebelum satu karyawan bisa masuk tabel `employees` versi ERD: `employee_number`, `full_name`, `position_id`, `pay_group_id`, `join_date`.

| Hasil | Jumlah | Arti |
|---|---|---|
| Nama di `saat ini` | 19 | Bukan pernyataan bahwa seed sudah lengkap |
| Siap secara field wajib | 6 | Outlet, bulanan, jabatan kolom E terisi, tanggal bergabung terurai, satu ID September cocok persis |
| Belum siap | 13 | Tanggal bergabung kosong, jabatan kosong, pay group Dapur Pusat bulanan tidak dipetakan, atau ID tidak cocok persis |
| Payroll tanpa roster | 1 | Content specialist di sheet September tidak ada di `saat ini`, tidak di-seed |

Enam baris siap tetap `validation_required_before_production: true`. Lokasi "Outlet" tidak dijadikan FK `OUTLET_BAROS`. Atasan semua `null`. Tidak ada user karyawan, jadi tidak ada role `subordinat` atau `superordinat` yang dipasang pada orang.

Pemetaan pay group yang dipakai, dan hanya ini:

- kolom A `Outlet` dan kolom B `Bulanan` → `MONTHLY_OUTLET`
- kolom A `Dapur Pusat` dan kolom B `Mingguan` → `WEEKLY_DAPUR`

`Bulanan` di Dapur Pusat tidak dipaksa menjadi kelompok kantor atau office hour. Nama yang mirip tetapi tidak persis (ejaan atau nama pendek) dicatat di `possible_same_person_not_merged` dan ID-nya tidak dipakai.

## Relasi

`org_profile` satu baris adalah identitas deployment, belum ditulis ulang di `drizzle/seed.ts`.

Lokasi yang namanya eksplisit di kolom A hanya `Dapur Pusat`. Label `Outlet` tidak ditutup ke satu kode lokasi.

Jabatan siap memakai teks kolom E. Posisi payroll yang berbeda dicatat sebagai `conflicts`, bukan sebagai pengganti roster.

`supervisor_employee_number` kosong untuk semua orang, termasuk placeholder superadmin. Satu kolom atasan, tanpa rekursi. Null diizinkan.

Rantai organisasi → lokasi → jabatan → kelompok gaji → user → atasan **belum tertutup** untuk baris mana pun.
