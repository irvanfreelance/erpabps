-- 0011_seed_october_2026_data.sql
-- 1. Tambah hari libur nasional 22 Oktober 2026 (Hari Santri Nasional)
INSERT INTO holidays (holiday_date, name, is_sunday)
VALUES ('2026-10-22'::date, 'Hari Santri Nasional', FALSE)
ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name, is_sunday = EXCLUDED.is_sunday;

