-- Seed Hari Libur Nasional & Cuti Bersama Indonesia (Desember 2026 - Desember 2027)

INSERT INTO holidays (holiday_date, name, is_sunday) VALUES
  -- Desember 2026
  ('2026-12-25', 'Hari Raya Natal', FALSE),
  ('2026-12-26', 'Cuti Bersama Hari Raya Natal', FALSE),

  -- Tahun 2027
  ('2027-01-01', 'Tahun Baru 2027 Masehi', FALSE),
  ('2027-01-20', 'Isra Mikraj Nabi Muhammad SAW', FALSE),
  ('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili', FALSE),
  ('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)', FALSE),
  ('2027-03-09', 'Hari Raya Idul Fitri 1448 H (Hari 1)', FALSE),
  ('2027-03-10', 'Hari Raya Idul Fitri 1448 H (Hari 2)', FALSE),
  ('2027-03-11', 'Cuti Bersama Hari Raya Idul Fitri 1448 H', FALSE),
  ('2027-03-12', 'Cuti Bersama Hari Raya Idul Fitri 1448 H', FALSE),
  ('2027-03-26', 'Wafat Yesus Kristus (Jumat Agung)', FALSE),
  ('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)', TRUE),
  ('2027-05-01', 'Hari Buruh Internasional', FALSE),
  ('2027-05-06', 'Kenaikan Yesus Kristus', FALSE),
  ('2027-05-16', 'Hari Raya Idul Adha 1448 H', TRUE),
  ('2027-05-20', 'Hari Raya Waisak 2571 BE', FALSE),
  ('2027-06-01', 'Hari Lahir Pancasila', FALSE),
  ('2027-06-06', 'Tahun Baru Islam 1449 Hijriah', TRUE),
  ('2027-08-15', 'Maulid Nabi Muhammad SAW', TRUE),
  ('2027-08-17', 'Hari Kemerdekaan Republik Indonesia ke-82', FALSE),
  ('2027-12-25', 'Hari Raya Natal', FALSE),
  ('2027-12-26', 'Cuti Bersama Hari Raya Natal', TRUE)
ON CONFLICT (holiday_date) DO UPDATE SET
  name = EXCLUDED.name,
  is_sunday = EXCLUDED.is_sunday;
