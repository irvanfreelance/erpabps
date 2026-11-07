-- Baseline ERP HRD. Database kosong tidak pernah membuat tabel donatur.
-- org_profile, app_config, users, user_tokens, dan audit_logs dipertahankan.
-- Jika tabel HRD sudah ada, CREATE IF NOT EXISTS tidak mengubah data.
-- Tabel domain CRM yang tersisa dari rantai lama dihapus. Tabel HRD tidak di-drop.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS app_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT         NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE app_config IS 'Konfigurasi teknis lembaga. Bukan registry aturan payroll.';

CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL    PRIMARY KEY,
    nama          VARCHAR(200) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  NOT NULL DEFAULT 'subordinat',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'subordinat';
UPDATE users SET role = CASE
    WHEN role = 'admin' THEN 'superadmin'
    WHEN role = 'supervisor' THEN 'superordinat'
    WHEN role IN ('superadmin', 'superordinat', 'subordinat') THEN role
    ELSE 'subordinat'
END;
ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role;
ALTER TABLE users ADD CONSTRAINT ck_users_role
    CHECK (role IN ('superadmin', 'superordinat', 'subordinat'));
COMMENT ON COLUMN users.role IS 'superadmin | superordinat | subordinat';

CREATE TABLE IF NOT EXISTS user_tokens (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id),
    token_hash   VARCHAR(255) NOT NULL UNIQUE,
    source       VARCHAR(50)  NOT NULL DEFAULT 'web_session',
    label        VARCHAR(100),
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    is_revoked   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       REFERENCES users(id),
    action        VARCHAR(50)  NOT NULL,
    entity_type   VARCHAR(50)  NOT NULL,
    entity_id     BIGINT,
    field_changed VARCHAR(100),
    value_before  JSONB,
    value_after   JSONB,
    source        VARCHAR(50)  NOT NULL DEFAULT 'web_app',
    ip_address    VARCHAR(50),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE audit_logs IS 'Immutable. Tidak menyimpan referensi donatur.';
DROP INDEX IF EXISTS idx_audit_donor;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS donor_id;

CREATE TABLE IF NOT EXISTS org_profile (
    id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nama            VARCHAR(200) NOT NULL,
    nama_singkat    VARCHAR(40)  NOT NULL,
    tagline         VARCHAR(200) NOT NULL DEFAULT '',
    logo_url        TEXT,
    primary_color   VARCHAR(7)   NOT NULL DEFAULT '#01665a',
    sidebar_color   VARCHAR(7)   NOT NULL DEFAULT '#01665a',
    accent_color    VARCHAR(7)   NOT NULL DEFAULT '#2e8b7a',
    is_seed_default BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    favicon_url     TEXT
);
ALTER TABLE org_profile ADD COLUMN IF NOT EXISTS favicon_url TEXT;
COMMENT ON TABLE org_profile IS 'Satu baris identitas lembaga. Seed hanya menimpa jika is_seed_default = TRUE.';

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON user_tokens(token_hash) WHERE is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_tokens_user ON user_tokens(user_id) WHERE is_revoked = FALSE;

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upd_users ON users;
CREATE TRIGGER trg_upd_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TABLE IF EXISTS saved_segment_results CASCADE;
DROP TABLE IF EXISTS saved_segments CASCADE;
DROP TABLE IF EXISTS blast_records CASCADE;
DROP TABLE IF EXISTS blast_batches CASCADE;
DROP TABLE IF EXISTS donor_assignment_history CASCADE;
DROP TABLE IF EXISTS distribute_batches CASCADE;
DROP TABLE IF EXISTS donor_dynamic_fields CASCADE;
DROP TABLE IF EXISTS donor_search_index CASCADE;
DROP TABLE IF EXISTS prospect_notes CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS data_imports CASCADE;
DROP TABLE IF EXISTS donors CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS field_definitions CASCADE;
DROP TABLE IF EXISTS vendor_profiles CASCADE;
DROP TABLE IF EXISTS extension_configs CASCADE;
DROP TABLE IF EXISTS tag_definitions CASCADE;

DROP FUNCTION IF EXISTS fn_rebuild_search_index(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS fn_recalculate_rfm() CASCADE;
DROP FUNCTION IF EXISTS fn_update_donor_stats() CASCADE;
DROP FUNCTION IF EXISTS fn_set_bulan_program() CASCADE;

CREATE TABLE IF NOT EXISTS locations (
    id                          BIGSERIAL PRIMARY KEY,
    code                        VARCHAR(50)  NOT NULL UNIQUE,
    name                        VARCHAR(255) NOT NULL,
    address                     TEXT,
    latitude                    NUMERIC(10,7),
    longitude                   NUMERIC(10,7),
    radius_meter                INT          NOT NULL DEFAULT 100,
    allow_outside_with_reason   BOOLEAN      NOT NULL DEFAULT TRUE,
    require_photo               BOOLEAN      NOT NULL DEFAULT TRUE,
    restrict_mock_location      BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active                   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ
);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS radius_meter INT NOT NULL DEFAULT 100;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS address TEXT;

CREATE TABLE IF NOT EXISTS departments (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    parent_id   BIGINT       REFERENCES departments(id),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS positions (
    id              BIGSERIAL PRIMARY KEY,
    department_id   BIGINT       NOT NULL REFERENCES departments(id),
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50)  NOT NULL UNIQUE,
    payroll_type    VARCHAR(40)  NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pay_groups (
    id                BIGSERIAL PRIMARY KEY,
    code              VARCHAR(50)  NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    pay_frequency     VARCHAR(20)  NOT NULL,
    week_start_dow    SMALLINT,
    payday_day        SMALLINT,
    payday_dow        SMALLINT,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_pay_group_period CHECK (
        (pay_frequency = 'weekly' AND week_start_dow IS NOT NULL)
        OR (pay_frequency = 'monthly' AND payday_day BETWEEN 1 AND 28)
    )
);

CREATE TABLE IF NOT EXISTS employees (
    id                     BIGSERIAL PRIMARY KEY,
    user_id                BIGINT UNIQUE REFERENCES users(id),
    supervisor_employee_id BIGINT REFERENCES employees(id),
    position_id            BIGINT REFERENCES positions(id),
    location_id            BIGINT REFERENCES locations(id),
    pay_group_id           BIGINT REFERENCES pay_groups(id),
    employee_number        VARCHAR(50) UNIQUE,
    full_name              VARCHAR(255) NOT NULL,
    email                  VARCHAR(255),
    phone                  VARCHAR(20),
    nik                    VARCHAR(20),
    npwp                   VARCHAR(30),
    bpjs_kesehatan_id      VARCHAR(20),
    bpjs_tk_id             VARCHAR(20),
    tax_status             VARCHAR(10),
    gender                 VARCHAR(10),
    marital_status         VARCHAR(20),
    address                TEXT,
    birth_date             DATE,
    join_date              DATE,
    record_status          VARCHAR(20) NOT NULL DEFAULT 'draft',
    source_row             INT UNIQUE,
    source_note            TEXT,
    end_date               DATE,
    employment_status      VARCHAR(30) NOT NULL DEFAULT 'contract',
    bank_name              VARCHAR(100),
    bank_account_number    VARCHAR(50),
    bank_account_name      VARCHAR(255),
    hourly_rate            NUMERIC(12,2),
    daily_rate             NUMERIC(12,2),
    has_login              BOOLEAN NOT NULL DEFAULT FALSE,
    in_payroll             BOOLEAN NOT NULL DEFAULT FALSE,
    validation_required    BOOLEAN NOT NULL DEFAULT TRUE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ,
    CONSTRAINT ck_employee_login CHECK (has_login = FALSE OR user_id IS NOT NULL),
    CONSTRAINT ck_supervisor_not_self CHECK (
        supervisor_employee_id IS NULL OR supervisor_employee_id <> id
    ),
    CONSTRAINT ck_employee_active CHECK (
        record_status <> 'active'
        OR (
            join_date IS NOT NULL
            AND position_id IS NOT NULL
            AND pay_group_id IS NOT NULL
            AND employee_number IS NOT NULL
        )
    ),
    CONSTRAINT ck_payroll_only_active CHECK (in_payroll = FALSE OR record_status = 'active')
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ktp_image_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS npwp VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_kesehatan_id VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bpjs_tk_id VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_status VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_emp_group ON employees(pay_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emp_supervisor ON employees(supervisor_employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_name ON employees USING GIN (full_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS salary_components (
    id             BIGSERIAL PRIMARY KEY,
    code           VARCHAR(50) NOT NULL UNIQUE,
    name           VARCHAR(255) NOT NULL,
    component_type VARCHAR(30) NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_salary_components (
    id                  BIGSERIAL PRIMARY KEY,
    employee_id         BIGINT NOT NULL REFERENCES employees(id),
    salary_component_id BIGINT NOT NULL REFERENCES salary_components(id),
    amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
    effective_from      DATE NOT NULL,
    effective_until     DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_esc_range CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE IF NOT EXISTS pay_rules (
    id                         BIGSERIAL PRIMARY KEY,
    pay_group_id               BIGINT NOT NULL REFERENCES pay_groups(id),
    effective_from             DATE NOT NULL,
    effective_until            DATE,
    hours_basis                VARCHAR(30) NOT NULL,
    earliest_count_time        TIME,
    late_deduction_mode        VARCHAR(30) NOT NULL DEFAULT 'none',
    late_deduction_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
    overtime_mode              VARCHAR(20) NOT NULL DEFAULT 'flat_per_hour',
    overtime_flat_rate         NUMERIC(15,2) NOT NULL DEFAULT 0,
    overtime_threshold_minutes INT NOT NULL DEFAULT 0,
    overtime_grace_minutes     INT NOT NULL DEFAULT 0,
    overtime_rounding          VARCHAR(20) NOT NULL DEFAULT 'none',
    source_ref                 VARCHAR(40) NOT NULL,
    notes                      TEXT,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_pay_rule_clamp CHECK (
        hours_basis <> 'counted_clock_in' OR earliest_count_time IS NOT NULL
    ),
    CONSTRAINT uq_pay_rule UNIQUE (pay_group_id, effective_from)
);

CREATE TABLE IF NOT EXISTS shift_templates (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(20) NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    shift_kind    VARCHAR(20) NOT NULL DEFAULT 'regular',
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    late_policy   VARCHAR(20) NOT NULL DEFAULT 'inherit',
    break_minutes INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    CONSTRAINT ck_backup_no_late CHECK (shift_kind <> 'backup' OR late_policy = 'none')
);

CREATE TABLE IF NOT EXISTS shift_assignments (
    id                BIGSERIAL PRIMARY KEY,
    employee_id       BIGINT NOT NULL REFERENCES employees(id),
    shift_template_id BIGINT NOT NULL REFERENCES shift_templates(id),
    location_id       BIGINT REFERENCES locations(id),
    work_date         DATE NOT NULL,
    station_code      VARCHAR(10),
    day_status        VARCHAR(20) NOT NULL DEFAULT 'work',
    is_backup         BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_by       BIGINT NOT NULL REFERENCES users(id),
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shift_day UNIQUE (employee_id, work_date)
);

ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS end_time TIME;

CREATE TABLE IF NOT EXISTS shift_swap_requests (
    id                      BIGSERIAL PRIMARY KEY,
    requester_id            BIGINT NOT NULL REFERENCES employees(id),
    target_employee_id      BIGINT NOT NULL REFERENCES employees(id),
    requester_assignment_id BIGINT NOT NULL REFERENCES shift_assignments(id),
    target_assignment_id    BIGINT REFERENCES shift_assignments(id),
    swap_date               DATE NOT NULL,
    reason                  TEXT,
    status                  VARCHAR(30) NOT NULL DEFAULT 'pending',
    decided_by              BIGINT REFERENCES users(id),
    decided_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendances (
    id                  BIGSERIAL PRIMARY KEY,
    employee_id         BIGINT NOT NULL REFERENCES employees(id),
    location_id         BIGINT REFERENCES locations(id),
    shift_assignment_id BIGINT REFERENCES shift_assignments(id),
    attendance_date     DATE NOT NULL,
    clock_in_at         TIMESTAMPTZ,
    clock_out_at        TIMESTAMPTZ,
    clock_in_lat        NUMERIC(10,7),
    clock_in_lng        NUMERIC(10,7),
    clock_out_lat       NUMERIC(10,7),
    clock_out_lng       NUMERIC(10,7),
    clock_in_accuracy   NUMERIC(8,2),
    clock_in_photo_url  TEXT,
    clock_out_photo_url TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'present',
    clock_in_status     VARCHAR(20) NOT NULL DEFAULT 'valid',
    is_mock_gps         BOOLEAN NOT NULL DEFAULT FALSE,
    late_minutes        INT NOT NULL DEFAULT 0,
    payable_minutes     INT NOT NULL DEFAULT 0,
    outside_radius_note TEXT,
    backdate_reason     TEXT,
    recorded_by         BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_att_emp_date UNIQUE (employee_id, attendance_date),
    CONSTRAINT ck_backdate CHECK (
        clock_in_status <> 'hr_backdate'
        OR (backdate_reason IS NOT NULL AND recorded_by IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id           BIGSERIAL PRIMARY KEY,
    employee_id  BIGINT NOT NULL REFERENCES employees(id),
    leave_type   VARCHAR(20) NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    reason       TEXT,
    document_url TEXT,
    notice_flag  VARCHAR(20) NOT NULL DEFAULT 'on_time',
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by  BIGINT REFERENCES users(id),
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS overtime_requests (
    id               BIGSERIAL PRIMARY KEY,
    employee_id      BIGINT NOT NULL REFERENCES employees(id),
    attendance_id    BIGINT REFERENCES attendances(id),
    overtime_date    DATE NOT NULL,
    duration_minutes INT NOT NULL,
    rate_mode        VARCHAR(20) NOT NULL DEFAULT 'flat_per_hour',
    flat_rate        NUMERIC(15,2) NOT NULL DEFAULT 0,
    payable_hours    NUMERIC(6,2) NOT NULL DEFAULT 0,
    source           VARCHAR(30) NOT NULL DEFAULT 'request_approval',
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by      BIGINT REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id                 BIGSERIAL PRIMARY KEY,
    pay_group_id       BIGINT NOT NULL REFERENCES pay_groups(id),
    period_start       DATE NOT NULL,
    period_end         DATE NOT NULL,
    pay_frequency      VARCHAR(20) NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'draft',
    run_type           VARCHAR(20) NOT NULL DEFAULT 'regular',
    adjusts_run_id     BIGINT REFERENCES payroll_runs(id),
    settings_frozen_at TIMESTAMPTZ,
    created_by         BIGINT NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_run_period CHECK (period_end >= period_start),
    CONSTRAINT uq_run UNIQUE (pay_group_id, period_start, run_type)
);

CREATE TABLE IF NOT EXISTS payroll_items (
    id              BIGSERIAL PRIMARY KEY,
    payroll_run_id  BIGINT NOT NULL REFERENCES payroll_runs(id),
    employee_id     BIGINT NOT NULL REFERENCES employees(id),
    payable_minutes INT NOT NULL DEFAULT 0,
    late_minutes    INT NOT NULL DEFAULT 0,
    earnings_total  NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_total NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_pay         NUMERIC(15,2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_item UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS payroll_item_details (
    id              BIGSERIAL PRIMARY KEY,
    payroll_item_id BIGINT NOT NULL REFERENCES payroll_items(id),
    component_code  VARCHAR(50) NOT NULL,
    quantity        NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_rate       NUMERIC(15,2) NOT NULL DEFAULT 0,
    amount          NUMERIC(15,2) NOT NULL,
    source_ref      VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS payroll_run_snapshots (
    id                BIGSERIAL PRIMARY KEY,
    payroll_run_id    BIGINT NOT NULL REFERENCES payroll_runs(id),
    employee_id       BIGINT REFERENCES employees(id),
    resolved_settings JSONB NOT NULL,
    settings_hash     CHAR(64) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_snapshot UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS cash_advances (
    id                 BIGSERIAL PRIMARY KEY,
    employee_id        BIGINT NOT NULL REFERENCES employees(id),
    requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    amount             NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    installment_count  INT NOT NULL CHECK (installment_count > 0),
    installment_amount NUMERIC(15,2) NOT NULL CHECK (installment_amount > 0),
    interval_unit      VARCHAR(20) NOT NULL,
    interval_every     INT NOT NULL DEFAULT 1 CHECK (interval_every > 0),
    remaining_amount   NUMERIC(15,2) NOT NULL,
    screening_status   VARCHAR(20) NOT NULL DEFAULT 'submitted',
    screened_by        BIGINT REFERENCES users(id),
    screened_at        TIMESTAMPTZ,
    source_fund        VARCHAR(50),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_advance_repayments (
    id              BIGSERIAL PRIMARY KEY,
    cash_advance_id BIGINT NOT NULL REFERENCES cash_advances(id),
    payroll_item_id BIGINT REFERENCES payroll_items(id),
    amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_stage_options (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(40) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    duration_months INT NOT NULL CHECK (duration_months > 0),
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS employment_contracts (
    id              BIGSERIAL PRIMARY KEY,
    employee_id     BIGINT NOT NULL REFERENCES employees(id),
    stage_option_id BIGINT NOT NULL REFERENCES contract_stage_options(id),
    sequence_no     INT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    created_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_contract_dates CHECK (end_date > start_date),
    CONSTRAINT uq_contract_seq UNIQUE (employee_id, sequence_no)
);

ALTER TABLE employment_contracts ALTER COLUMN created_by DROP NOT NULL;

CREATE TABLE IF NOT EXISTS outlet_revenues (
    id              BIGSERIAL PRIMARY KEY,
    location_id     BIGINT NOT NULL REFERENCES locations(id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    gross_amount    NUMERIC(18,2) NOT NULL,
    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    ojol_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
    net_amount      NUMERIC(18,2) NOT NULL,
    source          VARCHAR(30) NOT NULL DEFAULT 'manual',
    input_by        BIGINT NOT NULL REFERENCES users(id),
    verified_by     BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bonus_pools (
    id                BIGSERIAL PRIMARY KEY,
    pool_kind         VARCHAR(30) NOT NULL,
    pay_group_id      BIGINT REFERENCES pay_groups(id),
    location_id       BIGINT REFERENCES locations(id),
    outlet_revenue_id BIGINT REFERENCES outlet_revenues(id),
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    pool_amount       NUMERIC(15,2) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'draft',
    source_ref        VARCHAR(40) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_pool_kind CHECK (
        (pool_kind = 'outlet_revenue' AND outlet_revenue_id IS NOT NULL)
        OR pool_kind <> 'outlet_revenue'
    )
);

CREATE TABLE IF NOT EXISTS bonus_pool_components (
    id                   BIGSERIAL PRIMARY KEY,
    bonus_pool_id        BIGINT NOT NULL REFERENCES bonus_pools(id),
    code                 VARCHAR(30) NOT NULL,
    amount               NUMERIC(15,2),
    late_threshold_min   INT,
    late_compare         VARCHAR(10),
    remainder_population VARCHAR(40),
    CONSTRAINT uq_pool_component UNIQUE (bonus_pool_id, code),
    CONSTRAINT ck_remainder_population CHECK (
        code <> 'remainder' OR remainder_population IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS bonus_allocations (
    id             BIGSERIAL PRIMARY KEY,
    bonus_pool_id  BIGINT NOT NULL REFERENCES bonus_pools(id),
    employee_id    BIGINT NOT NULL REFERENCES employees(id),
    component_code VARCHAR(30) NOT NULL,
    amount         NUMERIC(15,2) NOT NULL,
    reason         TEXT,
    CONSTRAINT uq_alloc UNIQUE (bonus_pool_id, employee_id, component_code)
);

CREATE TABLE IF NOT EXISTS piece_rate_items (
    id             BIGSERIAL PRIMARY KEY,
    code           VARCHAR(50) NOT NULL,
    name           VARCHAR(255) NOT NULL,
    unit           VARCHAR(20) NOT NULL,
    rate           NUMERIC(15,2) NOT NULL,
    effective_from DATE NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    source_ref     VARCHAR(40) NOT NULL DEFAULT 'sheet',
    CONSTRAINT uq_piece UNIQUE (code, effective_from)
);

CREATE TABLE IF NOT EXISTS piece_work_entries (
    id                 BIGSERIAL PRIMARY KEY,
    employee_id        BIGINT NOT NULL REFERENCES employees(id),
    piece_rate_item_id BIGINT NOT NULL REFERENCES piece_rate_items(id),
    work_date          DATE NOT NULL,
    quantity           NUMERIC(10,2) NOT NULL,
    rate_snapshot      NUMERIC(15,2) NOT NULL,
    amount             NUMERIC(15,2) NOT NULL,
    recorded_by        BIGINT NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visit_logs (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT NOT NULL REFERENCES employees(id),
    visit_date    DATE NOT NULL,
    rate_snapshot NUMERIC(15,2) NOT NULL,
    recorded_by   BIGINT NOT NULL REFERENCES users(id),
    CONSTRAINT uq_visit UNIQUE (employee_id, visit_date)
);

CREATE TABLE IF NOT EXISTS salary_holdbacks (
    id          BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    amount      NUMERIC(15,2) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'held',
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
    id           BIGSERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    name         VARCHAR(255) NOT NULL,
    is_sunday    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS setting_definitions (
    id             BIGSERIAL PRIMARY KEY,
    key            VARCHAR(150) NOT NULL UNIQUE,
    category       VARCHAR(50) NOT NULL,
    label          VARCHAR(255) NOT NULL,
    value_type     VARCHAR(20) NOT NULL,
    default_value  JSONB NOT NULL,
    allowed_scopes VARCHAR(20)[] NOT NULL,
    is_locked      BOOLEAN NOT NULL DEFAULT FALSE,
    question_ref   VARCHAR(20),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS setting_options (
    id            BIGSERIAL PRIMARY KEY,
    definition_id BIGINT NOT NULL REFERENCES setting_definitions(id),
    value         VARCHAR(100) NOT NULL,
    label         VARCHAR(255) NOT NULL,
    CONSTRAINT uq_setting_option UNIQUE (definition_id, value)
);

CREATE TABLE IF NOT EXISTS setting_values (
    id             BIGSERIAL PRIMARY KEY,
    definition_id  BIGINT NOT NULL REFERENCES setting_definitions(id),
    scope_type     VARCHAR(20) NOT NULL,
    scope_id       BIGINT,
    value          JSONB NOT NULL,
    effective_from DATE NOT NULL,
    effective_to   DATE,
    status         VARCHAR(20) NOT NULL DEFAULT 'active',
    source_ref     VARCHAR(40) NOT NULL,
    reason         TEXT NOT NULL,
    created_by     BIGINT NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_org_scope CHECK ((scope_type = 'org') = (scope_id IS NULL)),
    CONSTRAINT ck_sv_range CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ex_no_overlap EXCLUDE USING gist (
        definition_id WITH =,
        scope_type WITH =,
        COALESCE(scope_id, 0) WITH =,
        daterange(effective_from, effective_to, '[)') WITH &&
    ) WHERE (status = 'active')
);

CREATE TABLE IF NOT EXISTS setting_audit_logs (
    id             BIGSERIAL PRIMARY KEY,
    definition_key VARCHAR(150) NOT NULL,
    action         VARCHAR(30) NOT NULL,
    scope_type     VARCHAR(20) NOT NULL,
    scope_id       BIGINT,
    old_value      JSONB,
    new_value      JSONB,
    source_ref     VARCHAR(40),
    reason         TEXT,
    actor_id       BIGINT NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_policies (
    id                  BIGSERIAL PRIMARY KEY,
    definition_id       BIGINT REFERENCES setting_definitions(id),
    category            VARCHAR(50),
    scope_type          VARCHAR(20) NOT NULL DEFAULT 'org',
    scope_id            BIGINT,
    requires_approval   BOOLEAN NOT NULL,
    approver_roles      VARCHAR(50)[] NOT NULL,
    min_approvers       SMALLINT NOT NULL DEFAULT 1 CHECK (min_approvers BETWEEN 1 AND 5),
    approval_mode       VARCHAR(20) NOT NULL DEFAULT 'any',
    allow_self_approval BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    reason              TEXT NOT NULL,
    created_by          BIGINT NOT NULL REFERENCES users(id),
    CONSTRAINT ck_no_self CHECK (allow_self_approval = FALSE),
    CONSTRAINT ck_policy_target CHECK (definition_id IS NOT NULL OR category IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id              BIGSERIAL PRIMARY KEY,
    policy_id       BIGINT NOT NULL REFERENCES approval_policies(id),
    target_type     VARCHAR(40) NOT NULL,
    target_id       BIGINT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    policy_snapshot JSONB NOT NULL,
    requested_by    BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_decisions (
    id         BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL REFERENCES approval_requests(id),
    actor_id   BIGINT NOT NULL REFERENCES users(id),
    decision   VARCHAR(20) NOT NULL,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_decision UNIQUE (request_id, actor_id)
);
