# ERD & Skema Data
# ERP HRD — Absensi & Payroll IPA · Ayam Bakar Pucuk Singkong

**Database:** PostgreSQL 15+
**Versi:** 3.0 — 6 November 2026
**Edisi:** satu lembaga, mengikuti boilerplate repo
**Sumber aturan:** `refs/prd.md` versi 3.0
**Bukan** skema multi-tenant prototipe HRD v2.2

Dokumen ini mengganti entitas CRM (donatur, program, campaign, transaksi, blast, segmen, prospek) dengan domain HRD. Bentuk tabel `org_profile`, `app_config`, `users`, `user_tokens`, dan `audit_logs` mengikuti migrasi yang sudah ada. Label `users.role` pada kontrak ERP hanya tiga. Tidak ada data pribadi pada seed.

---

## 1. Konvensi

- PK `BIGSERIAL`, kecuali `org_profile.id` yang `SMALLINT` dan wajib `1`.
- Status dan jenis: `VARCHAR`, bukan ENUM database.
- Waktu: `TIMESTAMPTZ`. Jam dinding jadwal: `TIME`.
- Soft delete: `deleted_at` pada master yang bisa diarsipkan.
- Jejak append-only: tidak ada `updated_at`.
- Tabel baru domain HRD memakai nama Inggris `snake_case` jamak, supaya tidak bentrok dengan kolom Indonesia pada tabel boilerplate.
- Tabel boilerplate di bawah disalin dari migrasi saat ini. Jangan diubah bentuknya hanya karena tema produk berganti.
- Tidak ada `tenant_id`. Scope lembaga = `org_profile` baris 1, atau `scope_type = 'org'` dengan `scope_id` kosong.
- Tidak ada PostGIS pada fase ini. Koordinat `NUMERIC`. Jarak dihitung di aplikasi.
- Ekstensi yang sudah ada: `pg_trgm`, `btree_gin`, `unaccent`. Registry pengaturan menambah `btree_gist` untuk larangan overlap tanggal.

---

## 2. Yang dipertahankan

Mekanisme persisten lembaga dan akun **wajib** tetap bentuk kolomnya. Label peran tidak memakai nilai CRM.

| Tabel | Peran |
|---|---|
| `org_profile` | Satu identitas lembaga |
| `app_config` | Key-value teknis lembaga, termasuk salinan nama aplikasi |
| `users` | Akun, `password_hash`, `role` teks |
| `user_tokens` | Token sesi dan API |
| `audit_logs` | Jejak umum, immutable |

`audit_logs.donor_id` adalah kolom warisan CRM. Domain HRD mengisi `entity_type` + `entity_id` dan membiarkan `donor_id` kosong. Kolom tidak dihapus di dokumen ini karena kode `logAudit` masih menuliskannya.

### 2.1 DDL persisten

```sql
CREATE TABLE app_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT         NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE app_config IS 'Konfigurasi teknis lembaga. Bukan registry aturan payroll.';

CREATE TABLE users (
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
COMMENT ON COLUMN users.role IS
  'Hanya superadmin | superordinat | subordinat. Migrasi kode saat ini masih DEFAULT tim_blast dan belum ada CHECK ini.';
ALTER TABLE users ADD CONSTRAINT ck_users_role
  CHECK (role IN ('superadmin', 'superordinat', 'subordinat'));

CREATE TABLE user_tokens (
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
COMMENT ON COLUMN user_tokens.source IS
  'Nilai baru ERP: web_session | api_key. Nilai CRM lama boleh tersisa dan tidak dipakai modul HRD.';

CREATE TABLE org_profile (
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
COMMENT ON TABLE org_profile IS 'Satu baris identitas lembaga. Seed hanya menimpa jika is_seed_default = TRUE.';

CREATE TABLE audit_logs (
    id            BIGSERIAL    PRIMARY KEY,
    user_id       BIGINT       REFERENCES users(id),
    donor_id      BIGINT       REFERENCES donors(id),
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
COMMENT ON TABLE audit_logs IS 'Immutable. HRD tidak mengisi donor_id.';
COMMENT ON COLUMN audit_logs.donor_id IS 'Warisan CRM. FK ke donors tetap ada di migrasi saat ini. Domain HRD mengosongkannya.';
```

Migrasi label, **belum dijalankan** dan belum ditulis ke `lib/db/migrations/`:

```sql
UPDATE users SET role = CASE role
  WHEN 'admin' THEN 'superadmin'
  WHEN 'supervisor' THEN 'superordinat'
  ELSE 'subordinat'
END
WHERE role IN ('admin', 'supervisor', 'data_analyst', 'tim_blast', 'read_only');
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'subordinat';
```

Jangan menjalankan cuplikan itu sebelum `lib/auth/rbac.ts` hanya mengenal tiga label. `drizzle/seed.ts` masih menulis label CRM. PR ini tidak mengubah berkas itu.

Tidak ada tabel `tenants` atau `custom_roles`. Kata sandi tidak disimpan di `employees`.

### 2.2 Atasan satu lapis

`employees.supervisor_employee_id` menunjuk ke satu karyawan atau `NULL`. Tidak ada tabel penutup, tidak ada kedalaman, tidak ada atasan dari atasan. `superadmin` boleh tanpa baris karyawan dan tanpa atasan.

---

## 3. Yang tidak dibawa ke domain HRD

Tabel berikut milik CRM di kode saat ini. Mereka bukan kontrak ERP fase absensi dan payroll, dan dokumen ini tidak mendesain ulang isinya:

`programs`, `campaigns`, `donors`, `transactions`, `field_definitions`, `donor_dynamic_fields`, `donor_search_index`, `prospect_notes`, `vendor_profiles`, `blast_batches`, `blast_records`, `saved_segments`, `saved_segment_results`, `donor_assignment_history`, `distribute_batches`, `extension_configs`, `tag_definitions`.

`data_imports` masih ada di kode (ada `blast_batch_id`). Impor HRD boleh memakai tabel itu nanti tanpa mengubah pola wizard. Bukan tabel domain baru.

---

## 4. Diagram domain

```
org_profile (1 baris)     users ── user_tokens
        │                    │
        │                    ├── audit_logs.user_id
        │                    └── employees.user_id (opsional)
        │
locations ── employees ── positions ── departments
                 │            │
                 │            └── employee_salary_components ── salary_components
                 │
                 ├── pay_groups ── pay_rules
                 ├── shift_assignments ── shift_templates
                 ├── attendances
                 ├── leave_requests
                 ├── overtime_requests
                 ├── cash_advances ── cash_advance_repayments
                 ├── employment_contracts ── contract_stage_options
                 └── payroll_items ── payroll_item_details
                         │
                    payroll_runs ── payroll_run_snapshots

setting_definitions ── setting_options
                   └── setting_values (scope + source_ref)
approval_policies ── approval_requests ── approval_decisions

outlet_revenues ── bonus_pools ── bonus_pool_components
                              └── bonus_allocations
```

Tidak ada garis ke gudang, barang, atau HPP.

---

## 5. DDL domain HRD

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- Lokasi kehadiran
-- ============================================================
CREATE TABLE locations (
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
COMMENT ON COLUMN locations.latitude IS 'Kosong = clock-in GPS belum diaktifkan untuk lokasi ini.';

-- ============================================================
-- Organisasi kerja
-- ============================================================
CREATE TABLE departments (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    parent_id   BIGINT       REFERENCES departments(id),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE positions (
    id              BIGSERIAL PRIMARY KEY,
    department_id   BIGINT       NOT NULL REFERENCES departments(id),
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50)  NOT NULL UNIQUE,
    payroll_type    VARCHAR(40)  NOT NULL,
      -- weekly_hourly | monthly_office | monthly_split | part_time_visit
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
COMMENT ON COLUMN positions.payroll_type IS
  'Hanya jenis perhitungan. Nominal tidak disimpan di jabatan.';

CREATE TABLE pay_groups (
    id                BIGSERIAL PRIMARY KEY,
    code              VARCHAR(50)  NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    pay_frequency     VARCHAR(20)  NOT NULL, -- weekly | monthly
    week_start_dow    SMALLINT,              -- 6 = Sabtu; wajib untuk weekly
    payday_day        SMALLINT,              -- tanggal 1 untuk default bulanan
    payday_dow        SMALLINT,              -- hari bayar mingguan
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_pay_group_period CHECK (
        (pay_frequency = 'weekly' AND week_start_dow IS NOT NULL)
        OR (pay_frequency = 'monthly' AND payday_day BETWEEN 1 AND 28)
    )
);
COMMENT ON TABLE pay_groups IS
  'Wajib terpisah untuk dapur mingguan, dapur office hour, outlet, kantor, dan part-time.';

-- ============================================================
-- Karyawan. Akses tidak disimpan di sini.
-- ============================================================
CREATE TABLE employees (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       UNIQUE REFERENCES users(id),
    supervisor_employee_id BIGINT    REFERENCES employees(id),
    position_id         BIGINT       NOT NULL REFERENCES positions(id),
    location_id         BIGINT       REFERENCES locations(id),
    pay_group_id        BIGINT       NOT NULL REFERENCES pay_groups(id),
    employee_number     VARCHAR(50)  NOT NULL UNIQUE,
    full_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255),
    phone               VARCHAR(20),
    nik                 VARCHAR(20),
    npwp                VARCHAR(30),
    gender              VARCHAR(10),
    birth_date          DATE,
    join_date           DATE         NOT NULL,
    end_date            DATE,
    employment_status   VARCHAR(30)  NOT NULL DEFAULT 'contract',
      -- permanent | contract | training | freelance | part_time | ended
    bank_name           VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_name   VARCHAR(255),
    hourly_rate         NUMERIC(12,2),
    daily_rate          NUMERIC(12,2),
    has_login           BOOLEAN      NOT NULL DEFAULT FALSE,
    in_payroll          BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT ck_employee_login CHECK (has_login = FALSE OR user_id IS NOT NULL),
    CONSTRAINT ck_supervisor_not_self CHECK (
        supervisor_employee_id IS NULL OR supervisor_employee_id <> id
    )
);
COMMENT ON COLUMN employees.supervisor_employee_id IS
  'Satu atasan langsung. NULL diizinkan. Bukan hierarki rekursif.';
CREATE INDEX idx_emp_supervisor ON employees(supervisor_employee_id);
COMMENT ON COLUMN employees.nik IS 'Kolom operasional. Dilarang diisi data asli di seed dan di dokumen.';
COMMENT ON COLUMN employees.hourly_rate IS 'Tarif crew dapur per orang. Bukan tarif global.';
CREATE INDEX idx_emp_group ON employees(pay_group_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_name ON employees USING GIN (full_name gin_trgm_ops);

-- ============================================================
-- Komponen kompensasi per orang
-- ============================================================
CREATE TABLE salary_components (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(50)  NOT NULL UNIQUE,
    name          VARCHAR(255) NOT NULL,
    component_type VARCHAR(30) NOT NULL,
      -- earning_fixed | earning_variable | earning_hourly | earning_daily | deduction
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE employee_salary_components (
    id                    BIGSERIAL PRIMARY KEY,
    employee_id           BIGINT       NOT NULL REFERENCES employees(id),
    salary_component_id   BIGINT       NOT NULL REFERENCES salary_components(id),
    amount                NUMERIC(15,2) NOT NULL DEFAULT 0,
    effective_from        DATE         NOT NULL,
    effective_until       DATE,
    notes                 TEXT,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_esc_range CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE INDEX idx_esc_emp ON employee_salary_components(employee_id, effective_from DESC);
COMMENT ON TABLE employee_salary_components IS
  'Contoh dokumen manager dapur (pokok 2.000.000 + 100.000/hari) disimpan di sini untuk satu karyawan, bukan di positions.';

-- ============================================================
-- Pay rules: satu baris milik satu kelompok, bukan aturan global
-- ============================================================
CREATE TABLE pay_rules (
    id                          BIGSERIAL PRIMARY KEY,
    pay_group_id                BIGINT       NOT NULL REFERENCES pay_groups(id),
    effective_from              DATE         NOT NULL,
    effective_until             DATE,
    hours_basis                 VARCHAR(30)  NOT NULL,
      -- raw_clock_in | counted_clock_in
    earliest_count_time         TIME,
    late_deduction_mode         VARCHAR(30)  NOT NULL DEFAULT 'none',
      -- none | per_minute | prorata_hourly | per_hour | flat_cut | tiered
    late_deduction_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
    overtime_mode               VARCHAR(20)  NOT NULL DEFAULT 'flat_per_hour',
    overtime_flat_rate          NUMERIC(15,2) NOT NULL DEFAULT 0,
    overtime_threshold_minutes  INT          NOT NULL DEFAULT 0,
    overtime_grace_minutes      INT          NOT NULL DEFAULT 0,
    overtime_rounding           VARCHAR(20)  NOT NULL DEFAULT 'none',
    source_ref                  VARCHAR(40)  NOT NULL,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_pay_rule_clamp CHECK (
        hours_basis <> 'counted_clock_in' OR earliest_count_time IS NOT NULL
    ),
    CONSTRAINT ck_pay_rule_range CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX uq_pay_rule_active
    ON pay_rules (pay_group_id, effective_from);
COMMENT ON TABLE pay_rules IS
  'Lapisan kompatibilitas. Sumber kebenaran angka baru = setting_values. Dapur dan outlet wajib beda pay_group_id.';

-- ============================================================
-- Shift
-- ============================================================
CREATE TABLE shift_templates (
    id                      BIGSERIAL PRIMARY KEY,
    code                    VARCHAR(20)  NOT NULL UNIQUE,
    name                    VARCHAR(100) NOT NULL,
    shift_kind              VARCHAR(20)  NOT NULL DEFAULT 'regular',
      -- regular | backup | office | custom
    start_time              TIME         NOT NULL,
    end_time                TIME         NOT NULL,
    late_policy             VARCHAR(20)  NOT NULL DEFAULT 'inherit',
      -- inherit | none
    break_minutes           INT          NOT NULL DEFAULT 0,
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT ck_backup_no_late CHECK (shift_kind <> 'backup' OR late_policy = 'none')
);
COMMENT ON CONSTRAINT ck_backup_no_late ON shift_templates IS
  'Wajib: shift backup tidak punya aturan telat.';

CREATE TABLE shift_assignments (
    id                  BIGSERIAL PRIMARY KEY,
    employee_id         BIGINT       NOT NULL REFERENCES employees(id),
    shift_template_id   BIGINT       NOT NULL REFERENCES shift_templates(id),
    location_id         BIGINT       REFERENCES locations(id),
    work_date           DATE         NOT NULL,
    station_code        VARCHAR(10),
      -- ck | kit | ks | se | bk | NULL
    day_status          VARCHAR(20)  NOT NULL DEFAULT 'work',
      -- work | off | off_izin | off_sakit
    is_backup           BOOLEAN      NOT NULL DEFAULT FALSE,
    assigned_by         BIGINT       NOT NULL REFERENCES users(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_shift_day UNIQUE (employee_id, work_date)
);
CREATE INDEX idx_shift_date ON shift_assignments(work_date);

CREATE TABLE shift_swap_requests (
    id                      BIGSERIAL PRIMARY KEY,
    requester_id            BIGINT       NOT NULL REFERENCES employees(id),
    target_employee_id      BIGINT       NOT NULL REFERENCES employees(id),
    requester_assignment_id BIGINT       NOT NULL REFERENCES shift_assignments(id),
    target_assignment_id    BIGINT       REFERENCES shift_assignments(id),
    swap_date               DATE         NOT NULL,
    reason                  TEXT,
    status                  VARCHAR(30)  NOT NULL DEFAULT 'pending',
      -- pending | target_accepted | approved | rejected | cancelled
    decided_by              BIGINT       REFERENCES users(id),
    decided_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- Presensi
-- ============================================================
CREATE TABLE attendances (
    id                    BIGSERIAL PRIMARY KEY,
    employee_id           BIGINT       NOT NULL REFERENCES employees(id),
    location_id           BIGINT       REFERENCES locations(id),
    shift_assignment_id   BIGINT       REFERENCES shift_assignments(id),
    attendance_date       DATE         NOT NULL,
    clock_in_at           TIMESTAMPTZ,
    clock_out_at          TIMESTAMPTZ,
    clock_in_lat          NUMERIC(10,7),
    clock_in_lng          NUMERIC(10,7),
    clock_out_lat         NUMERIC(10,7),
    clock_out_lng         NUMERIC(10,7),
    clock_in_accuracy     NUMERIC(8,2),
    clock_in_photo_url    TEXT,
    clock_out_photo_url   TEXT,
    status                VARCHAR(30)  NOT NULL DEFAULT 'present',
    clock_in_status       VARCHAR(20)  NOT NULL DEFAULT 'valid',
      -- valid | outside_radius | mock_gps | hr_backdate
    is_mock_gps           BOOLEAN      NOT NULL DEFAULT FALSE,
    late_minutes          INT          NOT NULL DEFAULT 0,
    payable_minutes       INT          NOT NULL DEFAULT 0,
    outside_radius_note   TEXT,
    backdate_reason       TEXT,
    recorded_by           BIGINT       REFERENCES users(id),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_att_emp_date UNIQUE (employee_id, attendance_date),
    CONSTRAINT ck_backdate CHECK (
        clock_in_status <> 'hr_backdate'
        OR (backdate_reason IS NOT NULL AND recorded_by IS NOT NULL)
    )
);
COMMENT ON COLUMN attendances.late_minutes IS
  'Diisi 0 bila mode telat scope = none atau shift backup / late_policy none.';
CREATE INDEX idx_att_emp_date ON attendances(employee_id, attendance_date DESC);

CREATE TABLE leave_requests (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT       NOT NULL REFERENCES employees(id),
    leave_type    VARCHAR(20)  NOT NULL, -- izin | sakit
    start_date    DATE         NOT NULL,
    end_date      DATE         NOT NULL,
    reason        TEXT,
    document_url  TEXT,
    notice_flag   VARCHAR(20)  NOT NULL DEFAULT 'on_time', -- on_time | late_notice
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
    reviewed_by   BIGINT       REFERENCES users(id),
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE overtime_requests (
    id                BIGSERIAL PRIMARY KEY,
    employee_id       BIGINT        NOT NULL REFERENCES employees(id),
    attendance_id     BIGINT        REFERENCES attendances(id),
    overtime_date     DATE          NOT NULL,
    duration_minutes  INT           NOT NULL,
    rate_mode         VARCHAR(20)   NOT NULL DEFAULT 'flat_per_hour',
    flat_rate         NUMERIC(15,2) NOT NULL DEFAULT 0,
    payable_hours     NUMERIC(6,2)  NOT NULL DEFAULT 0,
    source            VARCHAR(30)   NOT NULL DEFAULT 'request_approval',
      -- auto_from_attendance | request_approval
    status            VARCHAR(20)   NOT NULL DEFAULT 'pending',
    approved_by       BIGINT        REFERENCES users(id),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- Kasbon
-- ============================================================
CREATE TABLE cash_advances (
    id                   BIGSERIAL PRIMARY KEY,
    employee_id          BIGINT        NOT NULL REFERENCES employees(id),
    requested_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    amount               NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    installment_count    INT           NOT NULL CHECK (installment_count > 0),
    installment_amount   NUMERIC(15,2) NOT NULL CHECK (installment_amount > 0),
    interval_unit        VARCHAR(20)   NOT NULL,
      -- weekly | monthly | custom
    interval_every       INT           NOT NULL DEFAULT 1 CHECK (interval_every > 0),
    remaining_amount     NUMERIC(15,2) NOT NULL,
    screening_status     VARCHAR(20)   NOT NULL DEFAULT 'submitted',
      -- submitted | screened | rejected | settled | cancelled
    screened_by          BIGINT        REFERENCES users(id),
    screened_at          TIMESTAMPTZ,
    source_fund          VARCHAR(50),
    notes                TEXT,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE cash_advances IS
  'Karyawan memilih kali dan besar cicilan. Potongan otomatis tiap gajian hanya setelah screening HR.';

CREATE TABLE cash_advance_repayments (
    id                BIGSERIAL PRIMARY KEY,
    cash_advance_id   BIGINT        NOT NULL REFERENCES cash_advances(id),
    payroll_item_id   BIGINT,
    amount            NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
-- Kontrak
-- ============================================================
CREATE TABLE contract_stage_options (
    id               BIGSERIAL PRIMARY KEY,
    code             VARCHAR(40)  NOT NULL UNIQUE,
    name             VARCHAR(100) NOT NULL,
    duration_months  INT          NOT NULL CHECK (duration_months > 0),
    sort_order       INT          NOT NULL DEFAULT 0,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE employment_contracts (
    id               BIGSERIAL PRIMARY KEY,
    employee_id      BIGINT      NOT NULL REFERENCES employees(id),
    stage_option_id  BIGINT      NOT NULL REFERENCES contract_stage_options(id),
    sequence_no      INT         NOT NULL,
    start_date       DATE        NOT NULL,
    end_date         DATE        NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'scheduled',
      -- scheduled | active | completed | ended
    created_by       BIGINT      NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_contract_dates CHECK (end_date > start_date),
    CONSTRAINT uq_contract_seq UNIQUE (employee_id, sequence_no)
);
COMMENT ON TABLE employment_contracts IS
  'Masa kerja dihitung dari employees.join_date sampai end_date kontrak aktif atau hari ini. remind_days tidak disimpan sebagai angka tetap; lihat setting contract.remind_days.';

-- ============================================================
-- Payroll
-- ============================================================
CREATE TABLE payroll_runs (
    id                  BIGSERIAL PRIMARY KEY,
    pay_group_id        BIGINT       NOT NULL REFERENCES pay_groups(id),
    period_start        DATE         NOT NULL,
    period_end          DATE         NOT NULL,
    pay_frequency       VARCHAR(20)  NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'draft',
      -- draft | calculated | reviewed | approved | paid
    run_type            VARCHAR(20)  NOT NULL DEFAULT 'regular', -- regular | adjustment
    adjusts_run_id      BIGINT       REFERENCES payroll_runs(id),
    settings_frozen_at  TIMESTAMPTZ,
    created_by          BIGINT       NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_run_period CHECK (period_end >= period_start),
    CONSTRAINT uq_run UNIQUE (pay_group_id, period_start, run_type)
);

CREATE TABLE payroll_items (
    id                  BIGSERIAL PRIMARY KEY,
    payroll_run_id      BIGINT        NOT NULL REFERENCES payroll_runs(id),
    employee_id         BIGINT        NOT NULL REFERENCES employees(id),
    payable_minutes     INT           NOT NULL DEFAULT 0,
    late_minutes        INT           NOT NULL DEFAULT 0,
    earnings_total      NUMERIC(15,2) NOT NULL DEFAULT 0,
    deduction_total     NUMERIC(15,2) NOT NULL DEFAULT 0,
    net_pay             NUMERIC(15,2) NOT NULL DEFAULT 0,
    CONSTRAINT uq_item UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE payroll_item_details (
    id                BIGSERIAL PRIMARY KEY,
    payroll_item_id   BIGINT        NOT NULL REFERENCES payroll_items(id),
    component_code    VARCHAR(50)   NOT NULL,
    quantity          NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_rate         NUMERIC(15,2) NOT NULL DEFAULT 0,
    amount            NUMERIC(15,2) NOT NULL,
    source_ref        VARCHAR(40)
);

ALTER TABLE cash_advance_repayments
    ADD CONSTRAINT fk_repay_item
    FOREIGN KEY (payroll_item_id) REFERENCES payroll_items(id);

CREATE TABLE payroll_run_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    payroll_run_id      BIGINT   NOT NULL REFERENCES payroll_runs(id),
    employee_id         BIGINT   REFERENCES employees(id),
    resolved_settings   JSONB    NOT NULL,
    settings_hash       CHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_snapshot UNIQUE (payroll_run_id, employee_id)
);

-- ============================================================
-- Bonus — dua keluarga, tidak digabung
-- ============================================================
CREATE TABLE outlet_revenues (
    id                  BIGSERIAL PRIMARY KEY,
    location_id         BIGINT        NOT NULL REFERENCES locations(id),
    period_start        DATE          NOT NULL,
    period_end          DATE          NOT NULL,
    gross_amount        NUMERIC(18,2) NOT NULL,
    discount_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
    ojol_amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
    net_amount          NUMERIC(18,2) NOT NULL,
    source              VARCHAR(30)   NOT NULL DEFAULT 'manual',
    input_by            BIGINT        NOT NULL REFERENCES users(id),
    verified_by         BIGINT        REFERENCES users(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE bonus_pools (
    id                  BIGSERIAL PRIMARY KEY,
    pool_kind           VARCHAR(30)   NOT NULL,
      -- outlet_revenue | monthly_components | catering | achievement
    pay_group_id        BIGINT        REFERENCES pay_groups(id),
    location_id         BIGINT        REFERENCES locations(id),
    outlet_revenue_id   BIGINT        REFERENCES outlet_revenues(id),
    period_start        DATE          NOT NULL,
    period_end          DATE          NOT NULL,
    pool_amount         NUMERIC(15,2) NOT NULL,
    status              VARCHAR(20)   NOT NULL DEFAULT 'draft',
    source_ref          VARCHAR(40)   NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_pool_kind CHECK (
        (pool_kind = 'outlet_revenue' AND outlet_revenue_id IS NOT NULL)
        OR pool_kind <> 'outlet_revenue'
    )
);
COMMENT ON COLUMN bonus_pools.pool_amount IS
  'Diisi per periode. Contoh dokumen 4.000.000 bukan default kolom.';

CREATE TABLE bonus_pool_components (
    id                  BIGSERIAL PRIMARY KEY,
    bonus_pool_id       BIGINT        NOT NULL REFERENCES bonus_pools(id),
    code                VARCHAR(30)   NOT NULL, -- no_late | no_leave | remainder
    amount              NUMERIC(15,2),
    late_threshold_min  INT,
    late_compare        VARCHAR(10),           -- lt | lte
    remainder_population VARCHAR(40),
      -- all_in_pay_group | receivers_only | manual ; wajib untuk code remainder
    CONSTRAINT uq_pool_component UNIQUE (bonus_pool_id, code),
    CONSTRAINT ck_remainder_population CHECK (
        code <> 'remainder' OR remainder_population IS NOT NULL
    )
);
COMMENT ON TABLE bonus_pool_components IS
  'Contoh: no_late 100.000 bila total menit telat di bawah 5; no_leave 100.000; sisa dibagi rata. Populasi sisa wajib diisi, dokumen tidak menetapkannya.';

CREATE TABLE bonus_allocations (
    id              BIGSERIAL PRIMARY KEY,
    bonus_pool_id   BIGINT        NOT NULL REFERENCES bonus_pools(id),
    employee_id     BIGINT        NOT NULL REFERENCES employees(id),
    component_code  VARCHAR(30)   NOT NULL,
    amount          NUMERIC(15,2) NOT NULL,
    reason          TEXT,
    CONSTRAINT uq_alloc UNIQUE (bonus_pool_id, employee_id, component_code)
);

-- ============================================================
-- Borongan dan kunjungan, tarif per baris bukan global
-- ============================================================
CREATE TABLE piece_rate_items (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(50)   NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    unit            VARCHAR(20)   NOT NULL,
    rate            NUMERIC(15,2) NOT NULL,
    effective_from  DATE          NOT NULL,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    source_ref      VARCHAR(40)   NOT NULL DEFAULT 'sheet',
    CONSTRAINT uq_piece UNIQUE (code, effective_from)
);

CREATE TABLE piece_work_entries (
    id                  BIGSERIAL PRIMARY KEY,
    employee_id         BIGINT        NOT NULL REFERENCES employees(id),
    piece_rate_item_id  BIGINT        NOT NULL REFERENCES piece_rate_items(id),
    work_date           DATE          NOT NULL,
    quantity            NUMERIC(10,2) NOT NULL,
    rate_snapshot       NUMERIC(15,2) NOT NULL,
    amount              NUMERIC(15,2) NOT NULL,
    recorded_by         BIGINT        NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE visit_logs (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT        NOT NULL REFERENCES employees(id),
    visit_date    DATE          NOT NULL,
    rate_snapshot NUMERIC(15,2) NOT NULL,
    recorded_by   BIGINT        NOT NULL REFERENCES users(id),
    CONSTRAINT uq_visit UNIQUE (employee_id, visit_date)
);

CREATE TABLE salary_holdbacks (
    id              BIGSERIAL PRIMARY KEY,
    employee_id     BIGINT        NOT NULL REFERENCES employees(id),
    amount          NUMERIC(15,2) NOT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'held', -- held | released
    reason          TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE salary_holdbacks IS 'Fitur default mati. Bukan aturan dokumen Erp abs stok.';

CREATE TABLE holidays (
    id                BIGSERIAL PRIMARY KEY,
    holiday_date      DATE          NOT NULL UNIQUE,
    name              VARCHAR(255)  NOT NULL,
    is_sunday         BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE holidays IS
  'Nominal insentif tidak disimpan di sini. Nominal hidup di setting per kelompok.';
```

---

## 6. Registry pengaturan dan persetujuan

Urutan yang menang: `employee`, `position`, `location`, `pay_group`, `org`, lalu `default_value`.

`source_ref` wajib: `sheet`, `doc_erp_abs_stok`, `wa_bonus_outlet`, `manual`.

```sql
CREATE TABLE setting_definitions (
    id                BIGSERIAL PRIMARY KEY,
    key               VARCHAR(150) NOT NULL UNIQUE,
    category          VARCHAR(50)  NOT NULL,
    label             VARCHAR(255) NOT NULL,
    value_type        VARCHAR(20)  NOT NULL,
    default_value     JSONB        NOT NULL,
    allowed_scopes    VARCHAR(20)[] NOT NULL,
    is_locked         BOOLEAN      NOT NULL DEFAULT FALSE,
    question_ref      VARCHAR(20),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE setting_options (
    id              BIGSERIAL PRIMARY KEY,
    definition_id   BIGINT       NOT NULL REFERENCES setting_definitions(id),
    value           VARCHAR(100) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    CONSTRAINT uq_setting_option UNIQUE (definition_id, value)
);

CREATE TABLE setting_values (
    id              BIGSERIAL PRIMARY KEY,
    definition_id   BIGINT       NOT NULL REFERENCES setting_definitions(id),
    scope_type      VARCHAR(20)  NOT NULL,
      -- org | pay_group | location | position | employee
    scope_id        BIGINT,
    value           JSONB        NOT NULL,
    effective_from  DATE         NOT NULL,
    effective_to    DATE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',
    source_ref      VARCHAR(40)  NOT NULL,
    reason          TEXT         NOT NULL,
    created_by      BIGINT       NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_org_scope CHECK ((scope_type = 'org') = (scope_id IS NULL)),
    CONSTRAINT ck_sv_range CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ex_no_overlap EXCLUDE USING gist (
        definition_id WITH =,
        scope_type WITH =,
        COALESCE(scope_id, 0) WITH =,
        daterange(effective_from, effective_to, '[)') WITH &&
    ) WHERE (status = 'active')
);

CREATE TABLE setting_audit_logs (
    id                BIGSERIAL PRIMARY KEY,
    definition_key    VARCHAR(150) NOT NULL,
    action            VARCHAR(30)  NOT NULL,
    scope_type        VARCHAR(20)  NOT NULL,
    scope_id          BIGINT,
    old_value         JSONB,
    new_value         JSONB,
    source_ref        VARCHAR(40),
    reason            TEXT,
    actor_id          BIGINT       NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE approval_policies (
    id                  BIGSERIAL PRIMARY KEY,
    definition_id       BIGINT       REFERENCES setting_definitions(id),
    category            VARCHAR(50),
    scope_type          VARCHAR(20)  NOT NULL DEFAULT 'org',
    scope_id            BIGINT,
    requires_approval   BOOLEAN      NOT NULL,
    approver_roles      VARCHAR(50)[] NOT NULL,
    min_approvers       SMALLINT     NOT NULL DEFAULT 1 CHECK (min_approvers BETWEEN 1 AND 5),
    approval_mode       VARCHAR(20)  NOT NULL DEFAULT 'any',
    allow_self_approval BOOLEAN      NOT NULL DEFAULT FALSE,
    effective_from      DATE         NOT NULL,
    effective_to        DATE,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active',
    reason              TEXT         NOT NULL,
    created_by          BIGINT       NOT NULL REFERENCES users(id),
    CONSTRAINT ck_no_self CHECK (allow_self_approval = FALSE),
    CONSTRAINT ck_policy_target CHECK (definition_id IS NOT NULL OR category IS NOT NULL)
);
COMMENT ON COLUMN approval_policies.approver_roles IS
  'Hanya superadmin atau superordinat. Owner pada dokumen lama = superadmin.';

CREATE TABLE approval_requests (
    id              BIGSERIAL PRIMARY KEY,
    policy_id       BIGINT      NOT NULL REFERENCES approval_policies(id),
    target_type     VARCHAR(40) NOT NULL,
    target_id       BIGINT      NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    policy_snapshot JSONB       NOT NULL,
    requested_by    BIGINT      NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_decisions (
    id            BIGSERIAL PRIMARY KEY,
    request_id    BIGINT      NOT NULL REFERENCES approval_requests(id),
    actor_id      BIGINT      NOT NULL REFERENCES users(id),
    decision      VARCHAR(20) NOT NULL, -- approved | rejected
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_decision UNIQUE (request_id, actor_id)
);
```

`app_config` tidak menyimpan tarif, denda, atau bonus. `system.public_api` ada di registry dan `is_locked = true`.

---

## 7. Seed aturan: sheet lawan dokumen

Baris di bawah adalah konfigurasi scope. Angka contoh tidak disalin ke semua karyawan.

| definition key | scope | nilai | source_ref | catatan |
|---|---|---|---|---|
| `attendance.late_deduction_mode` | org | `none` | `doc_erp_abs_stok` | **Wajib** sebagai dasar lembaga |
| `attendance.late_deduction_mode` | pay group `WEEKLY_DAPUR` | `none` | `doc_erp_abs_stok` | **Wajib** |
| `attendance.late_deduction_mode` | pay group `MONTHLY_DAPUR_OFFICE` | `none` | `doc_erp_abs_stok` | **Wajib** |
| `attendance.late_deduction_mode` | pay group `MONTHLY_OUTLET` | `none` sampai profil sheet dinyalakan | `doc_erp_abs_stok` | Profil sheet `per_minute` contoh 500 disimpan `status = draft`, sumber `sheet` |
| `weekly.total_hours_basis` | pay group `WEEKLY_DAPUR` | `raw_clock_in` | `doc_erp_abs_stok` | Default kelompok |
| `weekly.total_hours_basis` | tidak dipasang di org | `counted_clock_in` + `05:00` hanya draft | `sheet` | Diaktifkan per karyawan atau jabatan bila masih dipakai |
| `period.monthly_payday_day` | pay group bulanan | `1` | `doc_erp_abs_stok` | Mengoreksi asumsi tanggal 3 |
| `period.week_start_dow` | `WEEKLY_DAPUR` | `6` (Sabtu) | `doc_erp_abs_stok` | Selaras dengan sheet |
| `holiday.incentive_amount` | kelompok bulanan | contoh `50000`, kecuali Minggu | `doc_erp_abs_stok` | Tidak disalin ke `WEEKLY_DAPUR` |
| `holiday.incentive_amount` | `WEEKLY_DAPUR` | tidak aktif | `sheet` | Profil sheet terpisah, draft |
| `bonus.outlet.tiers` | lokasi outlet | contoh tier changelog | `wa_bonus_outlet` | Bukan bonus Rp4.000.000 |
| `bonus.monthly.no_late_amount` | tidak di org | contoh `100000`, banding `lt`, ambang `5` | `doc_erp_abs_stok` | Template skema, bukan konstanta |
| `bonus.monthly.no_leave_amount` | template skema | contoh `100000` | `doc_erp_abs_stok` | |
| `bonus.monthly.remainder_population` | wajib saat hitung | kosong | `doc_erp_abs_stok` | Dokumen tidak menetapkan populasi |
| `contract.remind_days` | org | `null` | `manual` | Dokumen hanya menyebut pengingat |

Kelompok gaji yang di-seed:

| code | frequency | payday |
|---|---|---|
| `WEEKLY_DAPUR` | weekly, mulai Sabtu | hari akhir periode |
| `MONTHLY_DAPUR_OFFICE` | monthly, 1–akhir | tanggal 1 |
| `MONTHLY_OUTLET` | monthly | tanggal 1 |
| `MONTHLY_KANTOR` | monthly | tanggal 1 |
| `PART_TIME` | monthly | tanggal 1 |

Lokasi katalog: `DAPUR_PUSAT` (teks kolom roster). `OUTLET_BAROS` tidak dipasang ke karyawan. Label `Outlet` pada roster belum menjadi FK. Latitude dan longitude kosong.

Jabatan katalog tanpa nominal tetap tersedia untuk master. Jabatan orang hanya diisi dari kolom roster yang benar-benar terisi. Lihat `refs/seed-hrd.json`.

Komponen master, tanpa nominal default orang: `GAPOK`, `TUNJ_KEHADIRAN`, `TUNJ_TRANSPORT`, `TUNJ_JABATAN`, `TUNJ_TT`, `UPAH_JAM`, `UPAH_HARIAN`, `LEMBUR`, `INSENTIF_TGL_MERAH`, `BONUS`, `KASBON`, `POTONGAN_TELAT`, `POTONGAN_IZIN`, `POTONGAN_SAKIT`.

Template shift: `P1` 06:00–16:00, `P2` 11:30–21:30, `MID` 09:30–19:30, `S3` 12:30–21:30, `BACKUP` dengan `shift_kind = backup` dan `late_policy = none`, `DAPUR_JAM`, `OFFICE`.

Tahap kontrak: `training_1m` 1 bulan, `training_3m` 3 bulan, `contract_1y` 1 tahun.

`pay_rules` awal:

| kelompok | hours_basis | late mode | source_ref |
|---|---|---|---|
| `WEEKLY_DAPUR` | `raw_clock_in` | `none` | `doc_erp_abs_stok` |
| `MONTHLY_DAPUR_OFFICE` | tidak memakai jam-jaman | `none` | `doc_erp_abs_stok` |
| `MONTHLY_OUTLET` | tidak memakai jepitan 05:00 | `none` | `doc_erp_abs_stok` |
| `MONTHLY_KANTOR` | tidak memakai jepitan 05:00 | `none` | `doc_erp_abs_stok` |

Tidak ada karyawan contoh dan tidak ada nominal manajer yang di-seed sebagai default jabatan.

### 7.1 Orang dan akun

Sumber roster dan batas field ada di `refs/seed-hrd.md` serta `refs/seed-hrd.json`.

Yang dapat di-seed **tanpa** tabel baru, pada migrasi yang ada sekarang:

- `org_profile` dan `app_config`, lewat `drizzle/seed.ts` yang sudah ada. PR ini tidak mengganti nilainya.
- `users.role` secara tipe kolom muat tiga label baru, tetapi seed yang jalan masih menulis label CRM, dan `checkPermission` belum mengenal tiga label itu.

Yang **tidak** dapat di-seed tanpa migrasi HRD: `locations`, `positions`, `pay_groups`, `employees`, komponen, dan atasan. Karena itu tidak ada perubahan `drizzle/seed.ts` untuk karyawan.

Placeholder `superadmin` di JSON tidak punya email dan tidak punya password. Kolom `users.email` dan `users.password_hash` pada migrasi saat ini `NOT NULL`, jadi placeholder itu tidak di-insert.

Audit relasi pada berkas JSON: enam orang memenuhi field wajib ERD (nomor dari payroll yang cocok persis, nama, jabatan, kelompok `MONTHLY_OUTLET`, tanggal bergabung). Tiga belas orang di roster yang sama belum memenuhi. Satu orang payroll tidak ada di sheet `saat ini` dan tidak di-seed. Semua `supervisor_employee_id` kosong. Tidak ada user karyawan. Rantai organisasi → lokasi → jabatan → kelompok → user → atasan belum tertutup. Ini bukan seed lengkap.

---

## 8. Index yang dipakai laporan

- `attendances (employee_id, attendance_date DESC)`
- `shift_assignments (work_date)` dan unik `(employee_id, work_date)`
- `payroll_runs (pay_group_id, period_start)`
- `payroll_items (payroll_run_id, employee_id)`
- `cash_advances (employee_id, screening_status)`
- `setting_values` lookup scope + larangan overlap
- `employees.full_name` GIN `pg_trgm`

Partial index `WHERE deleted_at IS NULL` pada `employees`, `locations`, `positions`, `shift_templates`.

---

## 9. Di luar skema

Fase stok tidak menambah tabel barang, gudang, pembelian, distribusi, HPP, margin, atau hutang vendor. Alurnya dicatat di PRD bagian 17 saja.
