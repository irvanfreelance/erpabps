-- 0013_holiday_bonus_and_pool_enhancements.sql
-- 1. Setting definition untuk bonus insentif hadir tanggal merah dinamis
INSERT INTO setting_definitions (key, category, label, value_type, default_value, allowed_scopes, is_locked)
VALUES
 ('holiday.work_bonus_rate', 'payroll', 'Insentif hadir tanggal merah (Rupiah/hari)', 'integer', '{"v":50000}', '{org,pay_group,position,employee}', FALSE)
ON CONFLICT (key) DO NOTHING;

-- Nilai default setting lembaga
INSERT INTO setting_values (
  definition_id, scope_type, scope_id, value, effective_from, status, source_ref, reason, created_by
)
SELECT d.id, 'org', NULL, '{"v":50000}'::jsonb, DATE '2026-10-01', 'active', 'doc_erp_abs_stok', 'default insentif tanggal merah', 1
FROM setting_definitions d
WHERE d.key = 'holiday.work_bonus_rate'
  AND NOT EXISTS (
    SELECT 1 FROM setting_values v WHERE v.definition_id = d.id AND v.scope_type = 'org' AND v.status = 'active'
  );

