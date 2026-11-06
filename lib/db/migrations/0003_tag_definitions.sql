CREATE TABLE IF NOT EXISTS tag_definitions (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    nama        VARCHAR(120) NOT NULL,
    warna       VARCHAR(7)   NOT NULL DEFAULT '#01665a',
    deskripsi   TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tag_definitions_active
    ON tag_definitions(is_active, nama);
