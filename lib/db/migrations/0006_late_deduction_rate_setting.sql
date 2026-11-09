INSERT INTO setting_definitions (key, category, label, value_type, default_value, allowed_scopes, is_locked)
VALUES
  ('attendance.late_deduction_rate', 'attendance', 'Tarif potongan telat per menit (Rupiah)', 'integer', '{"v":1000}', '{org,pay_group,position,employee}', FALSE)
ON CONFLICT (key) DO NOTHING;
