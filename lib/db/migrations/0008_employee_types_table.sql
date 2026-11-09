CREATE TABLE IF NOT EXISTS employee_types (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

INSERT INTO employee_types (code, name, description)
VALUES
  ('dapur', 'Crew Dapur', 'Gaji per jam aktual, fleksibel tanpa jadwal shift dan denda telat'),
  ('outlet', 'Crew Outlet', 'Mengikuti roster jadwal shift, denda telat per menit dinamis'),
  ('office', 'Office', 'Jam kerja kantor reguler, denda telat per menit dinamis')
ON CONFLICT (code) DO NOTHING;

INSERT INTO setting_definitions (key, category, label, value_type, default_value, allowed_scopes, is_locked)
VALUES
  ('office.work_start_time', 'attendance', 'Jam mulai masuk kerja office (WIB)', 'string', '{"v":"08:00"}', '{org,position,employee}', FALSE),
  ('office.work_end_time', 'attendance', 'Jam selesai kerja office (WIB)', 'string', '{"v":"17:00"}', '{org,position,employee}', FALSE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO shift_templates (code, name, shift_kind, start_time, end_time, late_policy)
VALUES
  ('OFFICE', 'Reguler Office', 'regular', '08:00'::time, '17:00'::time, 'inherit')
ON CONFLICT (code) DO NOTHING;
