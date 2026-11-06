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
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE org_profile IS 'Satu baris identitas lembaga. Seed hanya menimpa jika is_seed_default = TRUE.';
