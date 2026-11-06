CREATE TABLE IF NOT EXISTS ranks (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ranks_active ON ranks(sort_order) WHERE deleted_at IS NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS rank_id BIGINT REFERENCES ranks(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ktp_image_url TEXT;

CREATE TABLE IF NOT EXISTS employee_educations (
    id           BIGSERIAL PRIMARY KEY,
    employee_id  BIGINT NOT NULL REFERENCES employees(id),
    level        VARCHAR(50) NOT NULL,
    institution  VARCHAR(255) NOT NULL,
    major        VARCHAR(255),
    start_year   INT,
    end_year     INT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edu_employee ON employee_educations(employee_id);

CREATE TABLE IF NOT EXISTS employee_family_members (
    id            BIGSERIAL PRIMARY KEY,
    employee_id   BIGINT NOT NULL REFERENCES employees(id),
    relation      VARCHAR(40) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    birth_date    DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fam_employee ON employee_family_members(employee_id);
