-- CRM RN schema — lembaga-agnostic. No seed data.
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- 01. APP_CONFIG
-- Key-value store untuk konfigurasi aplikasi.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT         NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE app_config IS 'Konfigurasi global aplikasi. Edit via admin panel.';

-- ============================================================
-- 02. USERS
-- role: admin | supervisor | data_analyst | tim_blast | read_only
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL    PRIMARY KEY,
    nama          VARCHAR(200) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  NOT NULL DEFAULT 'tim_blast',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);
COMMENT ON COLUMN users.role IS 'admin | supervisor | data_analyst | tim_blast | read_only';

-- ============================================================
-- 03. USER_TOKENS
-- source: web_session | chrome_extension | api_key | zains_sync | cf_sync
-- ============================================================
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

-- ============================================================
-- 04. PROGRAMS
-- Master program donasi. Setiap transaksi WAJIB linked ke sini.
-- slug: identifier unik, immutable, lowercase_underscore
--   contoh: ramadan, qurban, zakat_fitrah, zakat_mal, wakaf,
--           anak_yatim, bencana_alam, beasiswa, infaq, sedekah
-- kategori: reguler | seasonal | emergency | wakaf | zakat
-- periode_default: null = sepanjang tahun; ada = musiman
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
    id               BIGSERIAL    PRIMARY KEY,
    slug             VARCHAR(100) NOT NULL UNIQUE,
    nama             VARCHAR(200) NOT NULL,
    deskripsi        TEXT,
    kategori         VARCHAR(50)  NOT NULL DEFAULT 'reguler',
    -- reguler | seasonal | emergency | wakaf | zakat
    periode_mulai    DATE,
    periode_selesai  DATE,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order       SMALLINT     NOT NULL DEFAULT 0,
    created_by       BIGINT       REFERENCES users(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN programs.slug            IS 'Immutable. Dipakai sebagai key di program_participation search index.';
COMMENT ON COLUMN programs.kategori        IS 'reguler | seasonal | emergency | wakaf | zakat';
COMMENT ON COLUMN programs.periode_mulai   IS 'NULL = berlaku sepanjang tahun';
COMMENT ON COLUMN programs.periode_selesai IS 'NULL = tidak ada batas akhir';

-- ============================================================
-- 05. CAMPAIGNS
-- Master campaign blast. Satu campaign bisa linked ke satu program
-- (opsional), atau bersifat cross-program (program_id = NULL).
-- slug: unik, immutable
-- tipe: blast | event | reengagement | onboarding | seasonal
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id           BIGSERIAL    PRIMARY KEY,
    slug         VARCHAR(100) NOT NULL UNIQUE,
    nama         VARCHAR(300) NOT NULL,
    deskripsi    TEXT,
    program_id   BIGINT       REFERENCES programs(id),
    tipe         VARCHAR(50)  NOT NULL DEFAULT 'blast',
    -- blast | event | reengagement | onboarding | seasonal
    tgl_mulai    DATE,
    tgl_selesai  DATE,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by   BIGINT       REFERENCES users(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN campaigns.slug       IS 'Immutable. Contoh: ramadan_2025_g1, qurban_2025_early_bird';
COMMENT ON COLUMN campaigns.program_id IS 'NULL = campaign lintas program (re-engagement, dll.)';
COMMENT ON COLUMN campaigns.tipe       IS 'blast | event | reengagement | onboarding | seasonal';

-- ============================================================
-- 06. DONORS
-- Tabel inti. Satu row = satu donatur unik (no_hp_canonical).
-- Kolom denormalisasi (last_donation_*,total_*) di-update trigger.
--
-- status_kontak : aktif | tidak_aktif | mati | diblokir | opt_out
-- segmen_rfm    : champions | loyal | potential | at_risk | lost | new | one_time
-- sumber_reg    : zains | cf | manual | upload
-- follow_up     : in_progress | waiting_callback | closing | failed | escalate
-- ============================================================
CREATE TABLE IF NOT EXISTS donors (
    id                       BIGSERIAL    PRIMARY KEY,
    no_hp_canonical          VARCHAR(20)  NOT NULL UNIQUE,
    no_hp_variants           TEXT[]       NOT NULL DEFAULT '{}',
    nama_lengkap             VARCHAR(300) NOT NULL,
    email                    VARCHAR(255),
    tgl_registrasi           DATE,
    sumber_registrasi        VARCHAR(50)  NOT NULL DEFAULT 'manual',
    linked_zains_ids         TEXT[]       NOT NULL DEFAULT '{}',
    zains_id_primer          VARCHAR(100),
    status_kontak            VARCHAR(30)  NOT NULL DEFAULT 'aktif',
    segmen_rfm               VARCHAR(30),
    skor_r                   SMALLINT     CHECK (skor_r BETWEEN 1 AND 5),
    skor_f                   SMALLINT     CHECK (skor_f BETWEEN 1 AND 5),
    skor_m                   SMALLINT     CHECK (skor_m BETWEEN 1 AND 5),
    rfm_updated_at           TIMESTAMPTZ,
    tags                     TEXT[]       NOT NULL DEFAULT '{}',
    assigned_to              BIGINT       REFERENCES users(id),
    follow_up_status         VARCHAR(30),
    follow_up_due_date       DATE,
    assigned_at              TIMESTAMPTZ,

    -- Denormalisasi performa — di-update trigger setiap transaksi paid
    last_donation_at         DATE,
    last_donation_nominal    BIGINT,
    last_donation_program_id BIGINT       REFERENCES programs(id),
    total_donation_lifetime  BIGINT       NOT NULL DEFAULT 0,
    total_donation_count     INTEGER      NOT NULL DEFAULT 0,

    last_synced_at           TIMESTAMPTZ,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at               TIMESTAMPTZ
);
COMMENT ON COLUMN donors.no_hp_canonical          IS 'Format 62xxxxxxxxxx — unique key';
COMMENT ON COLUMN donors.linked_zains_ids         IS 'Array ID ZAINS — bisa >1 setelah merge duplikat';
COMMENT ON COLUMN donors.last_donation_program_id IS 'FK ke programs.id — bukan VARCHAR program name';
COMMENT ON COLUMN donors.total_donation_lifetime  IS 'Cached SUM nominal — trigger update setiap transaksi paid';

-- ============================================================
-- 07. TRANSACTIONS
-- Riwayat donasi. program_id WAJIB diisi — FK ke programs.
-- campaign_id opsional — jika terkait campaign tertentu.
-- bulan_program: CHAR(7) YYYY-MM — di-set trigger
-- status: paid | pending | failed | checkout
-- sumber: zains | cf | manual | upload
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id                  BIGSERIAL    PRIMARY KEY,
    donor_id            BIGINT       NOT NULL REFERENCES donors(id),
    program_id          BIGINT       NOT NULL REFERENCES programs(id),
    campaign_id         BIGINT       REFERENCES campaigns(id),
    id_transaksi_zains  VARCHAR(100),
    id_transaksi_cf     VARCHAR(100),
    tgl_transaksi       DATE         NOT NULL,
    bulan_program       CHAR(7)      NOT NULL,
    nominal             BIGINT       NOT NULL DEFAULT 0,
    status              VARCHAR(30)  NOT NULL DEFAULT 'paid',
    sumber              VARCHAR(30)  NOT NULL DEFAULT 'upload',
    catatan             TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN transactions.program_id    IS 'WAJIB — FK ke programs.id. Tidak boleh NULL.';
COMMENT ON COLUMN transactions.campaign_id   IS 'Opsional — jika transaksi terkait campaign tertentu';
COMMENT ON COLUMN transactions.bulan_program IS 'YYYY-MM dari tgl_transaksi — set via trigger. Index utama query temporal.';
COMMENT ON COLUMN transactions.nominal       IS 'Rupiah, integer BIGINT';

-- ============================================================
-- 08. FIELD_DEFINITIONS
-- tipe: text|number|date|boolean|dropdown|multiselect|url|phone
-- ============================================================
CREATE TABLE IF NOT EXISTS field_definitions (
    id               BIGSERIAL    PRIMARY KEY,
    slug             VARCHAR(100) NOT NULL UNIQUE,
    label            VARCHAR(200) NOT NULL,
    tipe             VARCHAR(30)  NOT NULL,
    options_json     JSONB        NOT NULL DEFAULT '[]',
    is_required      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_searchable    BOOLEAN      NOT NULL DEFAULT TRUE,
    visible_in_json  JSONB        NOT NULL DEFAULT '["profil","list","export"]',
    editable_by_json JSONB        NOT NULL DEFAULT '["admin","supervisor","data_analyst"]',
    sort_order       SMALLINT     NOT NULL DEFAULT 0,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by       BIGINT       REFERENCES users(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN field_definitions.slug IS 'Immutable setelah dibuat — key di search_doc.dynamic';

-- ============================================================
-- 09. DONOR_DYNAMIC_FIELDS
-- Nilai dipisah per tipe kolom untuk query range.
-- ============================================================
CREATE TABLE IF NOT EXISTS donor_dynamic_fields (
    id            BIGSERIAL    PRIMARY KEY,
    donor_id      BIGINT       NOT NULL REFERENCES donors(id),
    field_def_id  BIGINT       NOT NULL REFERENCES field_definitions(id),
    value_text    TEXT,
    value_number  NUMERIC(18,2),
    value_date    DATE,
    value_boolean BOOLEAN,
    value_json    JSONB,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by    BIGINT       REFERENCES users(id),
    CONSTRAINT uq_donor_field UNIQUE (donor_id, field_def_id)
);
COMMENT ON COLUMN donor_dynamic_fields.value_json IS 'Untuk tipe multiselect: ["ramadan","qurban"]';

-- ============================================================
-- 10. DONOR_SEARCH_INDEX
-- Materialized flat-index. SEMUA query filter & search lewat sini.
-- Di-rebuild async setiap ada perubahan.
--
-- search_doc struktur:
-- {
--   nama, no_hp, email,
--   status, segmen, tags[],
--   skor_r, skor_f, skor_m,
--   last_donation_date,
--   last_donation_program_id,   ← INT
--   last_donation_program_slug, ← "ramadan"
--   last_donation_nominal,
--   total_donation_lifetime, total_donation_count,
--   program_participation: {    ← key = program.slug
--     "ramadan": ["2023-Q1","2024-Q1","2025-Q1"],
--     "qurban":  ["2023-Q2","2024-Q2"]
--   },
--   assigned_to_id,
--   follow_up_status, follow_up_due_date,
--   last_prospected_at, last_prospect_response,
--   last_blast_at, last_blast_response,
--   dynamic: { field_slug: value }
-- }
-- ============================================================
CREATE TABLE IF NOT EXISTS donor_search_index (
    id            BIGSERIAL   PRIMARY KEY,
    donor_id      BIGINT      NOT NULL REFERENCES donors(id) UNIQUE,
    search_doc    JSONB       NOT NULL DEFAULT '{}',
    search_vector TSVECTOR,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE  donor_search_index IS 'Materialized index. Jangan filter ke donors/transactions langsung.';
COMMENT ON COLUMN donor_search_index.search_doc IS
    'program_participation menggunakan program.slug sebagai key, '
    'bukan nama program VARCHAR bebas';

-- ============================================================
-- 11. PROSPECT_NOTES
-- Immutable setelah INSERT.
-- channel      : wappin|mekari|cekat|manual|web_whatsapp_ext
-- respon_donatur: ceklis_satu|belum_merespon|hanya_read|merespon|
--                closing|gagal|memblokir|nomor_tidak_valid|opt_out
-- source       : web_app | chrome_extension
-- ============================================================
CREATE TABLE IF NOT EXISTS prospect_notes (
    id             BIGSERIAL    PRIMARY KEY,
    donor_id       BIGINT       NOT NULL REFERENCES donors(id),
    user_id        BIGINT       NOT NULL REFERENCES users(id),
    campaign_id    BIGINT       REFERENCES campaigns(id),
    tgl_prospek    DATE         NOT NULL DEFAULT CURRENT_DATE,
    channel        VARCHAR(50)  NOT NULL DEFAULT 'manual',
    respon_donatur VARCHAR(50),
    catatan_bebas  TEXT,
    source         VARCHAR(30)  NOT NULL DEFAULT 'web_app',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN prospect_notes.campaign_id IS 'FK ke campaigns — opsional, jika catatan terkait campaign';
COMMENT ON COLUMN prospect_notes.source IS 'web_app | chrome_extension';

-- ============================================================
-- 12. VENDOR_PROFILES
-- Mapping kolom laporan blast per vendor.
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_profiles (
    id             BIGSERIAL    PRIMARY KEY,
    nama_vendor    VARCHAR(100) NOT NULL,
    column_mapping JSONB        NOT NULL DEFAULT '{}',
    status_mapping JSONB        NOT NULL DEFAULT '{}',
    is_default     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_by     BIGINT       REFERENCES users(id),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN vendor_profiles.column_mapping IS '{"no_hp":"Phone Number","status":"Delivery Status"}';
COMMENT ON COLUMN vendor_profiles.status_mapping IS '{"Delivered":"terkirim","Failed":"nomor_mati"}';

-- ============================================================
-- 13. BLAST_BATCHES
-- Satu sesi import laporan blast, linked ke campaign.
-- import_status: pending | processing | done | failed
-- ============================================================
CREATE TABLE IF NOT EXISTS blast_batches (
    id                BIGSERIAL    PRIMARY KEY,
    campaign_id       BIGINT       REFERENCES campaigns(id),
    vendor_profile_id BIGINT       REFERENCES vendor_profiles(id),
    tgl_blast         DATE         NOT NULL,
    jumlah_target     INTEGER      NOT NULL DEFAULT 0,
    jumlah_terkirim   INTEGER      NOT NULL DEFAULT 0,
    jumlah_gagal      INTEGER      NOT NULL DEFAULT 0,
    jumlah_dibaca     INTEGER      NOT NULL DEFAULT 0,
    jumlah_respon     INTEGER      NOT NULL DEFAULT 0,
    jumlah_closing    INTEGER      NOT NULL DEFAULT 0,
    file_laporan_path VARCHAR(500),
    import_status     VARCHAR(30)  NOT NULL DEFAULT 'pending',
    import_error      TEXT,
    diimport_oleh     BIGINT       NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN blast_batches.campaign_id   IS 'FK ke campaigns — nama campaign dari sini, bukan VARCHAR';
COMMENT ON COLUMN blast_batches.import_status IS 'pending | processing | done | failed';

-- ============================================================
-- 14. BLAST_RECORDS
-- status_kirim: terkirim|gagal_limit|nomor_mati|diblokir|tidak_terdaftar
-- respon      : belum|dibaca|merespon|closing|memblokir
-- ============================================================
CREATE TABLE IF NOT EXISTS blast_records (
    id                BIGSERIAL    PRIMARY KEY,
    donor_id          BIGINT       NOT NULL REFERENCES donors(id),
    blast_batch_id    BIGINT       NOT NULL REFERENCES blast_batches(id),
    tgl_kirim         TIMESTAMPTZ,
    status_kirim      VARCHAR(30)  NOT NULL DEFAULT 'terkirim',
    dibaca            BOOLEAN,
    respon            VARCHAR(30)  NOT NULL DEFAULT 'belum',
    raw_vendor_status VARCHAR(200),
    catatan           TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON COLUMN blast_records.raw_vendor_status IS 'Status mentah dari file vendor sebelum di-mapping';

-- ============================================================
-- 15. SAVED_SEGMENTS
-- refresh_schedule: manual | daily | weekly
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_segments (
    id                BIGSERIAL    PRIMARY KEY,
    nama              VARCHAR(200) NOT NULL,
    deskripsi         TEXT,
    query_json        JSONB        NOT NULL DEFAULT '{}',
    is_public         BOOLEAN      NOT NULL DEFAULT FALSE,
    auto_refresh      BOOLEAN      NOT NULL DEFAULT FALSE,
    refresh_schedule  VARCHAR(20)  NOT NULL DEFAULT 'manual',
    last_count        INTEGER,
    last_refreshed_at TIMESTAMPTZ,
    dibuat_oleh       BIGINT       NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
-- 16. SAVED_SEGMENT_RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_segment_results (
    id         BIGSERIAL   PRIMARY KEY,
    segment_id BIGINT      NOT NULL REFERENCES saved_segments(id),
    donor_id   BIGINT      NOT NULL REFERENCES donors(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_segment_donor UNIQUE (segment_id, donor_id)
);

-- ============================================================
-- 17. DONOR_ASSIGNMENT_HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS donor_assignment_history (
    id                  BIGSERIAL   PRIMARY KEY,
    donor_id            BIGINT      NOT NULL REFERENCES donors(id),
    assigned_from       BIGINT      REFERENCES users(id),
    assigned_to         BIGINT      REFERENCES users(id),
    assigned_by         BIGINT      REFERENCES users(id),
    batch_distribute_id BIGINT,
    reason              VARCHAR(200),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 18. DISTRIBUTE_BATCHES
-- status: pending | processing | done | failed
-- ============================================================
CREATE TABLE IF NOT EXISTS distribute_batches (
    id              BIGSERIAL    PRIMARY KEY,
    segment_id      BIGINT       REFERENCES saved_segments(id),
    total_donors    INTEGER      NOT NULL DEFAULT 0,
    pic_count       INTEGER      NOT NULL DEFAULT 0,
    config_json     JSONB        NOT NULL DEFAULT '{}',
    status          VARCHAR(30)  NOT NULL DEFAULT 'pending',
    dijalankan_oleh BIGINT       NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);
COMMENT ON COLUMN distribute_batches.config_json IS '{"max_per_pic":500,"priority":"rfm_desc","pic_ids":[1,2]}';

-- ============================================================
-- 19. DATA_IMPORTS
-- entity_type: donors | transactions | blast_report
-- status     : pending | processing | done | failed | rolled_back
-- ============================================================
CREATE TABLE IF NOT EXISTS data_imports (
    id               BIGSERIAL    PRIMARY KEY,
    entity_type      VARCHAR(50)  NOT NULL,
    file_name        VARCHAR(300),
    file_path        VARCHAR(500),
    row_count_total  INTEGER      NOT NULL DEFAULT 0,
    row_count_new    INTEGER      NOT NULL DEFAULT 0,
    row_count_merge  INTEGER      NOT NULL DEFAULT 0,
    row_count_skip   INTEGER      NOT NULL DEFAULT 0,
    row_count_error  INTEGER      NOT NULL DEFAULT 0,
    status           VARCHAR(30)  NOT NULL DEFAULT 'pending',
    error_log        TEXT,
    blast_batch_id   BIGINT       REFERENCES blast_batches(id),
    diupload_oleh    BIGINT       NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ
);

-- ============================================================
-- 20. AUDIT_LOGS
-- Immutable — tidak boleh ada UPDATE atau DELETE.
-- action     : create|update|delete|assign|import|export|login|logout
-- entity_type: donor|transaction|prospect_note|field_def|user|segment
--              program|campaign
-- source     : web_app|chrome_extension|api|upload_import|zains_sync|cf_sync
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
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
COMMENT ON TABLE audit_logs IS 'Immutable — tidak boleh ada UPDATE atau DELETE.';

-- ============================================================
-- 21. EXTENSION_CONFIGS
-- ext_type: zains_sync|cf_sync|whatsapp_extension|vendor_blast_api
-- ============================================================
CREATE TABLE IF NOT EXISTS extension_configs (
    id              BIGSERIAL    PRIMARY KEY,
    ext_type        VARCHAR(50)  NOT NULL UNIQUE,
    is_active       BOOLEAN      NOT NULL DEFAULT FALSE,
    config_json     JSONB        NOT NULL DEFAULT '{}',
    status          VARCHAR(30)  NOT NULL DEFAULT 'idle',
    last_run_at     TIMESTAMPTZ,
    last_run_status VARCHAR(30),
    error_log       TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── USERS ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role)    WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- ── USER_TOKENS ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tokens_hash    ON user_tokens(token_hash) WHERE is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_tokens_user    ON user_tokens(user_id)    WHERE is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON user_tokens(expires_at)
    WHERE is_revoked = FALSE AND expires_at IS NOT NULL;

-- ── PROGRAMS ────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_slug   ON programs(slug);
CREATE INDEX        idx_programs_active ON programs(is_active, sort_order)
    WHERE is_active = TRUE;
CREATE INDEX        idx_programs_kat    ON programs(kategori)
    WHERE is_active = TRUE;

-- ── CAMPAIGNS ───────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_slug    ON campaigns(slug);
CREATE INDEX        idx_campaigns_program ON campaigns(program_id)
    WHERE is_active = TRUE;
CREATE INDEX        idx_campaigns_active  ON campaigns(is_active, tgl_mulai DESC);

-- ── DONORS ──────────────────────────────────────────────────────
-- #1: Lookup No. HP — query terbanyak (Chrome Extension + search bar)
CREATE UNIQUE INDEX IF NOT EXISTS idx_donors_hp
    ON donors(no_hp_canonical)
    WHERE deleted_at IS NULL;

-- #2: Filter status kontak
CREATE INDEX IF NOT EXISTS idx_donors_status
    ON donors(status_kontak)
    WHERE deleted_at IS NULL;

-- #3: Filter segmen RFM
CREATE INDEX IF NOT EXISTS idx_donors_segmen
    ON donors(segmen_rfm)
    WHERE deleted_at IS NULL AND segmen_rfm IS NOT NULL;

-- #4: Worklist per PIC
CREATE INDEX IF NOT EXISTS idx_donors_assigned
    ON donors(assigned_to)
    WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

-- #5: Follow-up overdue
CREATE INDEX IF NOT EXISTS idx_donors_followup_overdue
    ON donors(follow_up_due_date)
    WHERE deleted_at IS NULL
      AND follow_up_status IN ('in_progress','waiting_callback')
      AND follow_up_due_date IS NOT NULL;

-- #6: Sort by donasi terakhir
CREATE INDEX IF NOT EXISTS idx_donors_last_donation
    ON donors(last_donation_at DESC NULLS LAST)
    WHERE deleted_at IS NULL;

-- #7: GIN tags
CREATE INDEX IF NOT EXISTS idx_donors_tags
    ON donors USING GIN(tags)
    WHERE deleted_at IS NULL;

-- #8: GIN linked_zains_ids
CREATE INDEX IF NOT EXISTS idx_donors_zains_ids
    ON donors USING GIN(linked_zains_ids)
    WHERE deleted_at IS NULL;

-- #9: Trigram ILIKE nama
CREATE INDEX IF NOT EXISTS idx_donors_nama_trgm
    ON donors USING GIN(nama_lengkap gin_trgm_ops)
    WHERE deleted_at IS NULL;

-- #10: Filter program_id terakhir (bukan FK join overhead di worklist)
CREATE INDEX IF NOT EXISTS idx_donors_last_program
    ON donors(last_donation_program_id)
    WHERE deleted_at IS NULL AND last_donation_program_id IS NOT NULL;

-- ── TRANSACTIONS ────────────────────────────────────────────────
-- #1: Riwayat per donatur — profil tab riwayat
CREATE INDEX IF NOT EXISTS idx_trx_donor
    ON transactions(donor_id, tgl_transaksi DESC);

-- #2: Query program + bulan — INDEX TERPENTING
--     "transaksi program_id=1 antara 2025-01 dan 2025-03"
CREATE INDEX IF NOT EXISTS idx_trx_program_bulan
    ON transactions(program_id, bulan_program)
    WHERE status = 'paid';

-- #3: Filter program + donor (cek apakah donor pernah donasi program X)
CREATE INDEX IF NOT EXISTS idx_trx_donor_program
    ON transactions(donor_id, program_id)
    WHERE status = 'paid';

-- #4: Filter campaign
CREATE INDEX IF NOT EXISTS idx_trx_campaign
    ON transactions(campaign_id, tgl_transaksi DESC)
    WHERE campaign_id IS NOT NULL AND status = 'paid';

-- #5: Filter status + tanggal
CREATE INDEX IF NOT EXISTS idx_trx_status_tgl
    ON transactions(status, tgl_transaksi DESC);

-- #6: Lookup by ZAINS ID (sinkronisasi)
CREATE INDEX IF NOT EXISTS idx_trx_zains_id
    ON transactions(id_transaksi_zains)
    WHERE id_transaksi_zains IS NOT NULL;

-- ── FIELD_DEFINITIONS ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_field_defs_active
    ON field_definitions(sort_order)
    WHERE is_active = TRUE;

-- ── DONOR_DYNAMIC_FIELDS ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ddf_donor   ON donor_dynamic_fields(donor_id);
CREATE INDEX IF NOT EXISTS idx_ddf_field   ON donor_dynamic_fields(field_def_id);
CREATE INDEX IF NOT EXISTS idx_ddf_text    ON donor_dynamic_fields(field_def_id, value_text)
    WHERE value_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ddf_number  ON donor_dynamic_fields(field_def_id, value_number)
    WHERE value_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ddf_date    ON donor_dynamic_fields(field_def_id, value_date)
    WHERE value_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ddf_bool    ON donor_dynamic_fields(field_def_id, value_boolean)
    WHERE value_boolean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ddf_json    ON donor_dynamic_fields USING GIN(value_json)
    WHERE value_json IS NOT NULL;

-- ── DONOR_SEARCH_INDEX — INDEX PALING KRITIS ────────────────────
-- #1: GIN JSONB — semua filter @>, ?, ?|, ?&
CREATE INDEX IF NOT EXISTS idx_dsi_doc_gin
    ON donor_search_index USING GIN(search_doc);

-- #2: GIN tsvector — full-text search nama
CREATE INDEX IF NOT EXISTS idx_dsi_vector_gin
    ON donor_search_index USING GIN(search_vector);

-- #3–#9: Expression indexes — skip JSON parsing untuk field sering difilter
CREATE INDEX IF NOT EXISTS idx_dsi_status
    ON donor_search_index((search_doc->>'status'));

CREATE INDEX IF NOT EXISTS idx_dsi_segmen
    ON donor_search_index((search_doc->>'segmen'));

CREATE INDEX IF NOT EXISTS idx_dsi_assigned
    ON donor_search_index(((search_doc->>'assigned_to_id')::BIGINT))
    WHERE search_doc->>'assigned_to_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dsi_last_donation_date
    ON donor_search_index(((search_doc->>'last_donation_date')::DATE) DESC)
    WHERE search_doc->>'last_donation_date' IS NOT NULL
      AND search_doc->>'last_donation_date' != '';

CREATE INDEX IF NOT EXISTS idx_dsi_last_blast
    ON donor_search_index(((search_doc->>'last_blast_at')::DATE) DESC)
    WHERE search_doc->>'last_blast_at' IS NOT NULL
      AND search_doc->>'last_blast_at' != '';

-- #7: GIN program_participation — KUNCI query temporal
--     "ramadan ? '2025-Q1'" lewat index ini
CREATE INDEX IF NOT EXISTS idx_dsi_participation
    ON donor_search_index USING GIN((search_doc->'program_participation'));

-- #8: GIN dynamic fields
CREATE INDEX IF NOT EXISTS idx_dsi_dynamic
    ON donor_search_index USING GIN((search_doc->'dynamic'));

-- #9: GIN tags
CREATE INDEX IF NOT EXISTS idx_dsi_tags
    ON donor_search_index USING GIN((search_doc->'tags'));

-- ── PROSPECT_NOTES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pnotes_donor    ON prospect_notes(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnotes_user     ON prospect_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnotes_campaign ON prospect_notes(campaign_id, created_at DESC)
    WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pnotes_respon   ON prospect_notes(respon_donatur, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnotes_source   ON prospect_notes(source, created_at DESC);

-- ── BLAST_BATCHES ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bbatch_campaign ON blast_batches(campaign_id, tgl_blast DESC);
CREATE INDEX IF NOT EXISTS idx_bbatch_tgl      ON blast_batches(tgl_blast DESC);
CREATE INDEX IF NOT EXISTS idx_bbatch_status   ON blast_batches(import_status)
    WHERE import_status IN ('pending','processing');

-- ── BLAST_RECORDS ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brec_donor  ON blast_records(donor_id, tgl_kirim DESC);
CREATE INDEX IF NOT EXISTS idx_brec_batch  ON blast_records(blast_batch_id, status_kirim);
CREATE INDEX IF NOT EXISTS idx_brec_tgl    ON blast_records(tgl_kirim DESC);
CREATE INDEX IF NOT EXISTS idx_brec_status ON blast_records(status_kirim);

-- ── SAVED_SEGMENTS ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seg_user    ON saved_segments(dibuat_oleh);
CREATE INDEX IF NOT EXISTS idx_seg_public  ON saved_segments(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_seg_refresh ON saved_segments(refresh_schedule, last_refreshed_at)
    WHERE auto_refresh = TRUE;

CREATE INDEX IF NOT EXISTS idx_seg_results_seg   ON saved_segment_results(segment_id);
CREATE INDEX IF NOT EXISTS idx_seg_results_donor ON saved_segment_results(donor_id);

-- ── MISC ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assign_donor ON donor_assignment_history(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assign_to    ON donor_assignment_history(assigned_to, created_at DESC)
    WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imports_tgl    ON data_imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_status ON data_imports(status, created_at DESC)
    WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS idx_audit_tgl    ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_donor  ON audit_logs(donor_id, created_at DESC)
    WHERE donor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs(user_id, created_at DESC)
    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- ============================================================
-- F1. Set bulan_program otomatis dari tgl_transaksi
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_bulan_program()
RETURNS TRIGGER AS $$
BEGIN
    NEW.bulan_program := TO_CHAR(NEW.tgl_transaksi, 'YYYY-MM');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_bulan
    BEFORE INSERT OR UPDATE OF tgl_transaksi ON transactions
    FOR EACH ROW EXECUTE FUNCTION fn_set_bulan_program();

-- ============================================================
-- F2. Update denormalisasi donors setelah transaksi paid
--     last_donation_program_id menggunakan FK ke programs
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_donor_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'paid')
    OR (TG_OP = 'UPDATE' AND NEW.status = 'paid') THEN
        UPDATE donors SET
            last_donation_at         = (
                SELECT MAX(tgl_transaksi) FROM transactions
                WHERE donor_id = NEW.donor_id AND status = 'paid'),
            last_donation_nominal    = (
                SELECT nominal FROM transactions
                WHERE donor_id = NEW.donor_id AND status = 'paid'
                ORDER BY tgl_transaksi DESC, id DESC LIMIT 1),
            last_donation_program_id = (
                SELECT program_id FROM transactions
                WHERE donor_id = NEW.donor_id AND status = 'paid'
                ORDER BY tgl_transaksi DESC, id DESC LIMIT 1),
            total_donation_lifetime  = (
                SELECT COALESCE(SUM(nominal),0) FROM transactions
                WHERE donor_id = NEW.donor_id AND status = 'paid'),
            total_donation_count     = (
                SELECT COUNT(*) FROM transactions
                WHERE donor_id = NEW.donor_id AND status = 'paid'),
            updated_at = now()
        WHERE id = NEW.donor_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_donor_stats
    AFTER INSERT OR UPDATE OF status, nominal, tgl_transaksi ON transactions
    FOR EACH ROW EXECUTE FUNCTION fn_update_donor_stats();

-- ============================================================
-- F3. Rebuild search index untuk satu donor
-- Kunci: program_participation menggunakan programs.slug sebagai key,
-- bukan nama VARCHAR bebas. Dengan begitu query temporal menggunakan
-- slug yang konsisten dan bisa di-index dengan benar.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_rebuild_search_index(p_donor_id BIGINT)
RETURNS VOID AS $$
DECLARE
    v_d     donors%ROWTYPE;
    v_part  JSONB;
    v_dyn   JSONB;
    v_doc   JSONB;
    v_vec   TSVECTOR;
    v_note  RECORD;
    v_blast RECORD;
    v_prog  RECORD;
BEGIN
    SELECT * INTO v_d FROM donors WHERE id = p_donor_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- 1. program_participation pakai programs.slug sebagai key
    --    {slug_program: ["YYYY-Qn", ...]}
    SELECT jsonb_object_agg(
        p.slug,
        quarters
    ) INTO v_part
    FROM (
        SELECT
            t.program_id,
            jsonb_agg(DISTINCT
                to_char(date_trunc('quarter', t.tgl_transaksi), 'YYYY') ||
                '-Q' || extract(quarter FROM t.tgl_transaksi)::TEXT
            ) AS quarters
        FROM transactions t
        WHERE t.donor_id = p_donor_id AND t.status = 'paid'
        GROUP BY t.program_id
    ) x
    JOIN programs p ON p.id = x.program_id;
    v_part := COALESCE(v_part, '{}'::JSONB);

    -- 2. Dynamic fields (is_searchable = true)
    SELECT jsonb_object_agg(
        fd.slug,
        COALESCE(ddf.value_json,
                 to_jsonb(ddf.value_text),
                 to_jsonb(ddf.value_number),
                 to_jsonb(ddf.value_date),
                 to_jsonb(ddf.value_boolean))
    ) INTO v_dyn
    FROM donor_dynamic_fields ddf
    JOIN field_definitions fd ON fd.id = ddf.field_def_id
    WHERE ddf.donor_id = p_donor_id
      AND fd.is_searchable = TRUE AND fd.is_active = TRUE;
    v_dyn := COALESCE(v_dyn, '{}'::JSONB);

    -- 3. Last program slug untuk display
    SELECT p.id, p.slug, p.nama INTO v_prog
    FROM donors d
    LEFT JOIN programs p ON p.id = d.last_donation_program_id
    WHERE d.id = p_donor_id;

    -- 4. Last prospect note
    SELECT tgl_prospek, respon_donatur INTO v_note
    FROM prospect_notes
    WHERE donor_id = p_donor_id
    ORDER BY created_at DESC LIMIT 1;

    -- 5. Last blast
    SELECT tgl_kirim, respon INTO v_blast
    FROM blast_records
    WHERE donor_id = p_donor_id
    ORDER BY tgl_kirim DESC NULLS LAST LIMIT 1;

    -- 6. Susun search_doc
    v_doc := jsonb_build_object(
        'nama',                      lower(v_d.nama_lengkap),
        'no_hp',                     v_d.no_hp_canonical,
        'email',                     lower(COALESCE(v_d.email, '')),
        'status',                    v_d.status_kontak,
        'segmen',                    COALESCE(v_d.segmen_rfm, ''),
        'tags',                      to_jsonb(v_d.tags),
        'skor_r',                    COALESCE(v_d.skor_r, 0),
        'skor_f',                    COALESCE(v_d.skor_f, 0),
        'skor_m',                    COALESCE(v_d.skor_m, 0),
        'last_donation_date',        COALESCE(v_d.last_donation_at::TEXT, ''),
        'last_donation_program_id',  COALESCE(v_prog.id, 0),
        'last_donation_program_slug',COALESCE(v_prog.slug, ''),
        'last_donation_nominal',     COALESCE(v_d.last_donation_nominal, 0),
        'total_donation_lifetime',   v_d.total_donation_lifetime,
        'total_donation_count',      v_d.total_donation_count,
        'program_participation',     v_part,
        'assigned_to_id',            v_d.assigned_to,
        'follow_up_status',          COALESCE(v_d.follow_up_status, ''),
        'follow_up_due_date',        COALESCE(v_d.follow_up_due_date::TEXT, ''),
        'last_prospected_at',        COALESCE(v_note.tgl_prospek::TEXT, ''),
        'last_prospect_response',    COALESCE(v_note.respon_donatur, ''),
        'last_blast_at',             COALESCE(v_blast.tgl_kirim::TEXT, ''),
        'last_blast_response',       COALESCE(v_blast.respon, ''),
        'dynamic',                   v_dyn
    );

    -- 7. tsvector: nama (A), email (B), no_hp (C)
    v_vec :=
        setweight(to_tsvector('indonesian', unaccent(v_d.nama_lengkap)), 'A') ||
        setweight(to_tsvector('simple', COALESCE(v_d.email, '')), 'B')        ||
        setweight(to_tsvector('simple', v_d.no_hp_canonical), 'C');

    -- 8. Upsert
    INSERT INTO donor_search_index(donor_id, search_doc, search_vector, updated_at)
    VALUES (p_donor_id, v_doc, v_vec, now())
    ON CONFLICT (donor_id) DO UPDATE
        SET search_doc    = EXCLUDED.search_doc,
            search_vector = EXCLUDED.search_vector,
            updated_at    = now();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- F4. Kalkulasi RFM
-- ============================================================
CREATE OR REPLACE FUNCTION fn_recalculate_rfm()
RETURNS INTEGER AS $$
DECLARE
    v_months INTEGER;
    v_cutoff DATE;
    v_count  INTEGER := 0;
BEGIN
    SELECT COALESCE(value::INTEGER, 12) INTO v_months
    FROM app_config WHERE key = 'rfm_window_months';
    v_cutoff := CURRENT_DATE - (v_months || ' months')::INTERVAL;

    WITH raw AS (
        SELECT d.id AS donor_id,
               CURRENT_DATE - MAX(t.tgl_transaksi)  AS recency_days,
               COUNT(t.id)                           AS frequency,
               COALESCE(SUM(t.nominal), 0)           AS monetary
        FROM donors d
        LEFT JOIN transactions t ON t.donor_id = d.id
            AND t.status = 'paid' AND t.tgl_transaksi >= v_cutoff
        WHERE d.deleted_at IS NULL
        GROUP BY d.id
    ),
    scored AS (
        SELECT donor_id,
               CASE WHEN frequency = 0 THEN 1
                    ELSE NTILE(5) OVER (ORDER BY recency_days DESC) END AS r,
               CASE WHEN frequency = 0 THEN 1
                    ELSE NTILE(5) OVER (ORDER BY frequency ASC)    END AS f,
               CASE WHEN monetary = 0  THEN 1
                    ELSE NTILE(5) OVER (ORDER BY monetary ASC)     END AS m
        FROM raw
    ),
    segmented AS (
        SELECT donor_id, r, f, m,
               CASE
                   WHEN r >= 4 AND f >= 4 AND m >= 4 THEN 'champions'
                   WHEN f >= 3 AND m >= 3             THEN 'loyal'
                   WHEN r >= 3 AND f >= 2             THEN 'potential'
                   WHEN r <= 2 AND f >= 3             THEN 'at_risk'
                   WHEN r >= 4 AND f = 1              THEN 'new'
                   WHEN f = 1                         THEN 'one_time'
                   ELSE 'lost'
               END AS segmen
        FROM scored
    )
    UPDATE donors d SET
        skor_r = s.r, skor_f = s.f, skor_m = s.m,
        segmen_rfm = s.segmen,
        rfm_updated_at = now(), updated_at = now()
    FROM segmented s WHERE d.id = s.donor_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- F5. Auto-set updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_users           BEFORE UPDATE ON users                FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_programs        BEFORE UPDATE ON programs             FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_campaigns       BEFORE UPDATE ON campaigns            FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_donors          BEFORE UPDATE ON donors               FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_transactions    BEFORE UPDATE ON transactions         FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_field_defs      BEFORE UPDATE ON field_definitions    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_ddf             BEFORE UPDATE ON donor_dynamic_fields FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_vendor_profiles BEFORE UPDATE ON vendor_profiles      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_blast_batches   BEFORE UPDATE ON blast_batches        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_blast_records   BEFORE UPDATE ON blast_records        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_segments        BEFORE UPDATE ON saved_segments       FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_upd_ext_configs     BEFORE UPDATE ON extension_configs    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- VIEW: Worklist per PIC — JOIN ke programs untuk nama program
-- ============================================================
CREATE OR REPLACE VIEW v_donor_worklist AS
SELECT
    d.id, d.nama_lengkap, d.no_hp_canonical,
    d.status_kontak, d.segmen_rfm,
    d.skor_r, d.skor_f, d.skor_m,
    d.assigned_to, d.follow_up_status, d.follow_up_due_date,
    d.last_donation_at, d.last_donation_nominal,
    d.last_donation_program_id,
    p.nama  AS last_donation_program_nama,
    p.slug  AS last_donation_program_slug,
    d.total_donation_lifetime,
    pn.respon_donatur AS last_prospect_response,
    pn.tgl_prospek    AS last_prospected_at,
    pn.catatan_bebas  AS last_note_text,
    CASE
        WHEN d.follow_up_due_date < CURRENT_DATE
             AND d.follow_up_status IN ('in_progress','waiting_callback') THEN 1000
        WHEN d.segmen_rfm = 'at_risk'            THEN 500
        WHEN d.segmen_rfm = 'champions'          THEN 400
        WHEN d.follow_up_status = 'in_progress'  THEN 300
        WHEN d.last_donation_at IS NULL          THEN 200
        ELSE COALESCE(d.skor_r + d.skor_f + d.skor_m, 0) * 10
    END AS priority_score
FROM donors d
LEFT JOIN programs p ON p.id = d.last_donation_program_id
LEFT JOIN LATERAL (
    SELECT respon_donatur, tgl_prospek, catatan_bebas
    FROM prospect_notes
    WHERE donor_id = d.id
    ORDER BY created_at DESC LIMIT 1
) pn ON TRUE
WHERE d.deleted_at IS NULL;

COMMENT ON VIEW v_donor_worklist IS
    'Worklist Tim Blast. Filter: WHERE assigned_to = :uid. '
    'Includes program nama & slug via JOIN ke programs.';
