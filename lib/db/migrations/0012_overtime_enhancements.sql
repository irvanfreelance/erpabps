-- 0012_overtime_enhancements.sql
-- Tambahkan kolom notes, requested_by, approved_at pada overtime_requests
ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS requested_by BIGINT REFERENCES users(id);
ALTER TABLE overtime_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Tambah setting definition untuk tarif lembur default per jam
INSERT INTO setting_definitions (key, category, label, value_type, default_value, allowed_scopes, is_locked)
VALUES
 ('overtime.hourly_rate', 'payroll', 'Tarif lembur per jam (Rupiah)', 'integer', '{"v":25000}', '{org,pay_group,position,employee}', FALSE),
 ('allowance.attendance_daily', 'payroll', 'Tunjangan kehadiran harian (Rupiah)', 'integer', '{"v":20000}', '{org,pay_group,position,employee}', FALSE),
 ('allowance.transport_daily', 'payroll', 'Tunjangan transport harian (Rupiah)', 'integer', '{"v":15000}', '{org,pay_group,position,employee}', FALSE)
ON CONFLICT (key) DO NOTHING;

