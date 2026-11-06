# ERD & Database Schema — CRM Relawan Nusantara (Single Tenant)

**Database:** PostgreSQL 15+  
**Versi:** 2.0 — April 2026  
**Edisi:** Single Tenant

**Perubahan dari v1:**
- `programs` dipisah jadi tabel master tersendiri
- `transactions.program_id` FK ke `programs.id` — bukan VARCHAR bebas
- `campaigns` dipisah jadi tabel master — blast batch dikaitkan ke campaign
- `donor_search_index.program_participation` pakai `program.slug` dari master
- Semua nama program konsisten, tidak bisa typo

**Konvensi:**
- PK: `BIGSERIAL` — tidak pakai UUID
- Nilai lookup: `VARCHAR` — dikontrol FE/aplikasi, bukan enum DB
- Timestamp: `TIMESTAMPTZ` — selalu timezone-aware
- Soft delete via `deleted_at TIMESTAMPTZ`
- Tabel audit/catatan: tidak ada `updated_at` (immutable)
- Nama tabel: `snake_case`, plural

---

## 1. Ringkasan Tabel

| # | Tabel | Keterangan |
|---|---|---|
| 1 | `app_config` | Konfigurasi aplikasi (key-value) |
| 2 | `users` | Pengguna sistem |
| 3 | `user_tokens` | Token auth API & Chrome extension |
| 4 | `programs` | **Master program donasi** (Ramadan, Qurban, Wakaf, dll.) |
| 5 | `campaigns` | **Master campaign blast** — linked ke program |
| 6 | `donors` | Donatur — inti sistem, denormalisasi untuk performa |
| 7 | `transactions` | Riwayat donasi — `program_id` FK ke `programs` |
| 8 | `field_definitions` | Definisi dynamic fields — admin tambah kapan saja |
| 9 | `donor_dynamic_fields` | Nilai dynamic fields per donatur |
| 10 | `donor_search_index` | Materialized flat-index — semua query filter lewat sini |
| 11 | `prospect_notes` | Catatan prospek per interaksi |
| 12 | `vendor_profiles` | Konfigurasi mapping kolom laporan blast per vendor |
| 13 | `blast_batches` | Satu sesi import laporan blast — linked ke campaign |
| 14 | `blast_records` | Satu record per pesan per donatur |
| 15 | `saved_segments` | Query tersimpan dari Query Builder |
| 16 | `saved_segment_results` | Snapshot hasil segment |
| 17 | `donor_assignment_history` | Histori assignment donatur ke PIC |
| 18 | `distribute_batches` | Operasi auto-distribute massal |
| 19 | `data_imports` | Log upload/import file |
| 20 | `audit_logs` | Jejak perubahan — immutable |
| 21 | `extension_configs` | Config per extension |

---

## 2. ERD Diagram

```
app_config  (key-value, tidak ada FK)

users ──────────────────── user_tokens (user_id FK)
  │
  └── donors.assigned_to (FK nullable)

programs ──────────────────────────────────────── slug UNIQUE
  │
  └──(N) transactions.program_id (FK)
  └──(N) campaigns.program_id    (FK nullable)

campaigns ─────────────────────────────────────── slug UNIQUE
  │
  └──(N) blast_batches.campaign_id (FK nullable)
  └──(N) prospect_notes.campaign_id (FK nullable)
  └──(N) transactions.campaign_id  (FK nullable)

donors ─────────────────── transactions            (donor_id FK → program_id FK)
  │                  ├──── prospect_notes          (donor_id FK → campaign_id FK)
  │                  ├──── blast_records           (donor_id FK → blast_batch FK)
  │                  ├──── donor_dynamic_fields    (donor_id FK → field_def FK)
  │                  ├──── donor_search_index      (donor_id UNIQUE FK)
  │                  └──── donor_assignment_history (donor_id FK)

field_definitions ─────── donor_dynamic_fields    (field_def_id FK)

vendor_profiles ──────── blast_batches            (vendor_profile_id FK)
                              └── blast_records   (blast_batch_id FK)

saved_segments ─────────── saved_segment_results  (segment_id FK)

data_imports
distribute_batches
audit_logs
extension_configs
```

---

## 3. DDL — Schema Lengkap

```sql
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
CREATE TABLE app_config (
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
CREATE TABLE users (
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

-- ============================================================
-- 04. PROGRAMS
-- Master program donasi. Setiap transaksi WAJIB linked ke sini.
-- slug: identifier unik, immutable, lowercase_underscore
--   contoh: ramadan, qurban, zakat_fitrah, zakat_mal, wakaf,
--           anak_yatim, bencana_alam, beasiswa, infaq, sedekah
-- kategori: reguler | seasonal | emergency | wakaf | zakat
-- periode_default: null = sepanjang tahun; ada = musiman
-- ============================================================
CREATE TABLE programs (
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
CREATE TABLE campaigns (
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
CREATE TABLE donors (
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
CREATE TABLE transactions (
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
CREATE TABLE field_definitions (
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
CREATE TABLE donor_dynamic_fields (
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
CREATE TABLE donor_search_index (
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
CREATE TABLE prospect_notes (
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
CREATE TABLE vendor_profiles (
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
CREATE TABLE blast_batches (
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
CREATE TABLE blast_records (
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
CREATE TABLE saved_segments (
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
CREATE TABLE saved_segment_results (
    id         BIGSERIAL   PRIMARY KEY,
    segment_id BIGINT      NOT NULL REFERENCES saved_segments(id),
    donor_id   BIGINT      NOT NULL REFERENCES donors(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_segment_donor UNIQUE (segment_id, donor_id)
);

-- ============================================================
-- 17. DONOR_ASSIGNMENT_HISTORY
-- ============================================================
CREATE TABLE donor_assignment_history (
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
CREATE TABLE distribute_batches (
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
CREATE TABLE data_imports (
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
COMMENT ON TABLE audit_logs IS 'Immutable — tidak boleh ada UPDATE atau DELETE.';

-- ============================================================
-- 21. EXTENSION_CONFIGS
-- ext_type: zains_sync|cf_sync|whatsapp_extension|vendor_blast_api
-- ============================================================
CREATE TABLE extension_configs (
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
```


---

## 4. Index Strategy

```sql
-- ── USERS ───────────────────────────────────────────────────────
CREATE INDEX idx_users_role   ON users(role)    WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- ── USER_TOKENS ─────────────────────────────────────────────────
CREATE INDEX idx_tokens_hash    ON user_tokens(token_hash) WHERE is_revoked = FALSE;
CREATE INDEX idx_tokens_user    ON user_tokens(user_id)    WHERE is_revoked = FALSE;
CREATE INDEX idx_tokens_expires ON user_tokens(expires_at)
    WHERE is_revoked = FALSE AND expires_at IS NOT NULL;

-- ── PROGRAMS ────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_programs_slug   ON programs(slug);
CREATE INDEX        idx_programs_active ON programs(is_active, sort_order)
    WHERE is_active = TRUE;
CREATE INDEX        idx_programs_kat    ON programs(kategori)
    WHERE is_active = TRUE;

-- ── CAMPAIGNS ───────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_campaigns_slug    ON campaigns(slug);
CREATE INDEX        idx_campaigns_program ON campaigns(program_id)
    WHERE is_active = TRUE;
CREATE INDEX        idx_campaigns_active  ON campaigns(is_active, tgl_mulai DESC);

-- ── DONORS ──────────────────────────────────────────────────────
-- #1: Lookup No. HP — query terbanyak (Chrome Extension + search bar)
CREATE UNIQUE INDEX idx_donors_hp
    ON donors(no_hp_canonical)
    WHERE deleted_at IS NULL;

-- #2: Filter status kontak
CREATE INDEX idx_donors_status
    ON donors(status_kontak)
    WHERE deleted_at IS NULL;

-- #3: Filter segmen RFM
CREATE INDEX idx_donors_segmen
    ON donors(segmen_rfm)
    WHERE deleted_at IS NULL AND segmen_rfm IS NOT NULL;

-- #4: Worklist per PIC
CREATE INDEX idx_donors_assigned
    ON donors(assigned_to)
    WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

-- #5: Follow-up overdue
CREATE INDEX idx_donors_followup_overdue
    ON donors(follow_up_due_date)
    WHERE deleted_at IS NULL
      AND follow_up_status IN ('in_progress','waiting_callback')
      AND follow_up_due_date IS NOT NULL;

-- #6: Sort by donasi terakhir
CREATE INDEX idx_donors_last_donation
    ON donors(last_donation_at DESC NULLS LAST)
    WHERE deleted_at IS NULL;

-- #7: GIN tags
CREATE INDEX idx_donors_tags
    ON donors USING GIN(tags)
    WHERE deleted_at IS NULL;

-- #8: GIN linked_zains_ids
CREATE INDEX idx_donors_zains_ids
    ON donors USING GIN(linked_zains_ids)
    WHERE deleted_at IS NULL;

-- #9: Trigram ILIKE nama
CREATE INDEX idx_donors_nama_trgm
    ON donors USING GIN(nama_lengkap gin_trgm_ops)
    WHERE deleted_at IS NULL;

-- #10: Filter program_id terakhir (bukan FK join overhead di worklist)
CREATE INDEX idx_donors_last_program
    ON donors(last_donation_program_id)
    WHERE deleted_at IS NULL AND last_donation_program_id IS NOT NULL;

-- ── TRANSACTIONS ────────────────────────────────────────────────
-- #1: Riwayat per donatur — profil tab riwayat
CREATE INDEX idx_trx_donor
    ON transactions(donor_id, tgl_transaksi DESC);

-- #2: Query program + bulan — INDEX TERPENTING
--     "transaksi program_id=1 antara 2025-01 dan 2025-03"
CREATE INDEX idx_trx_program_bulan
    ON transactions(program_id, bulan_program)
    WHERE status = 'paid';

-- #3: Filter program + donor (cek apakah donor pernah donasi program X)
CREATE INDEX idx_trx_donor_program
    ON transactions(donor_id, program_id)
    WHERE status = 'paid';

-- #4: Filter campaign
CREATE INDEX idx_trx_campaign
    ON transactions(campaign_id, tgl_transaksi DESC)
    WHERE campaign_id IS NOT NULL AND status = 'paid';

-- #5: Filter status + tanggal
CREATE INDEX idx_trx_status_tgl
    ON transactions(status, tgl_transaksi DESC);

-- #6: Lookup by ZAINS ID (sinkronisasi)
CREATE INDEX idx_trx_zains_id
    ON transactions(id_transaksi_zains)
    WHERE id_transaksi_zains IS NOT NULL;

-- ── FIELD_DEFINITIONS ───────────────────────────────────────────
CREATE INDEX idx_field_defs_active
    ON field_definitions(sort_order)
    WHERE is_active = TRUE;

-- ── DONOR_DYNAMIC_FIELDS ────────────────────────────────────────
CREATE INDEX idx_ddf_donor   ON donor_dynamic_fields(donor_id);
CREATE INDEX idx_ddf_field   ON donor_dynamic_fields(field_def_id);
CREATE INDEX idx_ddf_text    ON donor_dynamic_fields(field_def_id, value_text)
    WHERE value_text IS NOT NULL;
CREATE INDEX idx_ddf_number  ON donor_dynamic_fields(field_def_id, value_number)
    WHERE value_number IS NOT NULL;
CREATE INDEX idx_ddf_date    ON donor_dynamic_fields(field_def_id, value_date)
    WHERE value_date IS NOT NULL;
CREATE INDEX idx_ddf_bool    ON donor_dynamic_fields(field_def_id, value_boolean)
    WHERE value_boolean IS NOT NULL;
CREATE INDEX idx_ddf_json    ON donor_dynamic_fields USING GIN(value_json)
    WHERE value_json IS NOT NULL;

-- ── DONOR_SEARCH_INDEX — INDEX PALING KRITIS ────────────────────
-- #1: GIN JSONB — semua filter @>, ?, ?|, ?&
CREATE INDEX idx_dsi_doc_gin
    ON donor_search_index USING GIN(search_doc);

-- #2: GIN tsvector — full-text search nama
CREATE INDEX idx_dsi_vector_gin
    ON donor_search_index USING GIN(search_vector);

-- #3–#9: Expression indexes — skip JSON parsing untuk field sering difilter
CREATE INDEX idx_dsi_status
    ON donor_search_index((search_doc->>'status'));

CREATE INDEX idx_dsi_segmen
    ON donor_search_index((search_doc->>'segmen'));

CREATE INDEX idx_dsi_assigned
    ON donor_search_index(((search_doc->>'assigned_to_id')::BIGINT))
    WHERE search_doc->>'assigned_to_id' IS NOT NULL;

CREATE INDEX idx_dsi_last_donation_date
    ON donor_search_index(((search_doc->>'last_donation_date')::DATE) DESC)
    WHERE search_doc->>'last_donation_date' IS NOT NULL
      AND search_doc->>'last_donation_date' != '';

CREATE INDEX idx_dsi_last_blast
    ON donor_search_index(((search_doc->>'last_blast_at')::DATE) DESC)
    WHERE search_doc->>'last_blast_at' IS NOT NULL
      AND search_doc->>'last_blast_at' != '';

-- #7: GIN program_participation — KUNCI query temporal
--     "ramadan ? '2025-Q1'" lewat index ini
CREATE INDEX idx_dsi_participation
    ON donor_search_index USING GIN((search_doc->'program_participation'));

-- #8: GIN dynamic fields
CREATE INDEX idx_dsi_dynamic
    ON donor_search_index USING GIN((search_doc->'dynamic'));

-- #9: GIN tags
CREATE INDEX idx_dsi_tags
    ON donor_search_index USING GIN((search_doc->'tags'));

-- ── PROSPECT_NOTES ──────────────────────────────────────────────
CREATE INDEX idx_pnotes_donor    ON prospect_notes(donor_id, created_at DESC);
CREATE INDEX idx_pnotes_user     ON prospect_notes(user_id, created_at DESC);
CREATE INDEX idx_pnotes_campaign ON prospect_notes(campaign_id, created_at DESC)
    WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_pnotes_respon   ON prospect_notes(respon_donatur, created_at DESC);
CREATE INDEX idx_pnotes_source   ON prospect_notes(source, created_at DESC);

-- ── BLAST_BATCHES ───────────────────────────────────────────────
CREATE INDEX idx_bbatch_campaign ON blast_batches(campaign_id, tgl_blast DESC);
CREATE INDEX idx_bbatch_tgl      ON blast_batches(tgl_blast DESC);
CREATE INDEX idx_bbatch_status   ON blast_batches(import_status)
    WHERE import_status IN ('pending','processing');

-- ── BLAST_RECORDS ───────────────────────────────────────────────
CREATE INDEX idx_brec_donor  ON blast_records(donor_id, tgl_kirim DESC);
CREATE INDEX idx_brec_batch  ON blast_records(blast_batch_id, status_kirim);
CREATE INDEX idx_brec_tgl    ON blast_records(tgl_kirim DESC);
CREATE INDEX idx_brec_status ON blast_records(status_kirim);

-- ── SAVED_SEGMENTS ──────────────────────────────────────────────
CREATE INDEX idx_seg_user    ON saved_segments(dibuat_oleh);
CREATE INDEX idx_seg_public  ON saved_segments(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_seg_refresh ON saved_segments(refresh_schedule, last_refreshed_at)
    WHERE auto_refresh = TRUE;

CREATE INDEX idx_seg_results_seg   ON saved_segment_results(segment_id);
CREATE INDEX idx_seg_results_donor ON saved_segment_results(donor_id);

-- ── MISC ────────────────────────────────────────────────────────
CREATE INDEX idx_assign_donor ON donor_assignment_history(donor_id, created_at DESC);
CREATE INDEX idx_assign_to    ON donor_assignment_history(assigned_to, created_at DESC)
    WHERE assigned_to IS NOT NULL;

CREATE INDEX idx_imports_tgl    ON data_imports(created_at DESC);
CREATE INDEX idx_imports_status ON data_imports(status, created_at DESC)
    WHERE status IN ('pending','processing');

CREATE INDEX idx_audit_tgl    ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_donor  ON audit_logs(donor_id, created_at DESC)
    WHERE donor_id IS NOT NULL;
CREATE INDEX idx_audit_user   ON audit_logs(user_id, created_at DESC)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
```


---

## 5. Trigger & Function

```sql
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
            ORDER BY 1) AS quarters
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
```


---

## 6. Seed Data

```sql
-- ============================================================
-- APP_CONFIG
-- ============================================================
INSERT INTO app_config (key, value, description) VALUES
('app_name',            'CRM Relawan Nusantara', 'Nama aplikasi'),
('timezone',            'Asia/Jakarta',           'Timezone default'),
('blast_cooldown_days', '14',                     'Jeda minimum blast ke donatur yang sama'),
('rfm_window_months',   '12',                     'Window kalkulasi RFM dalam bulan'),
('max_dynamic_fields',  '50',                     'Maks field dinamis'),
('version',             '2.0.0',                  'Versi skema DB');

-- ============================================================
-- USERS
-- ============================================================
INSERT INTO users (id, nama, email, password_hash, role) VALUES
( 1, 'Admin Sistem',      'dev@cnt.id',    '$2b$12$xxx', 'admin'),
( 2, 'Regi Fajar R.',     'regi@cnt.id',     '$2b$12$xxx', 'supervisor'),
( 3, 'Rizky Bachtiar',    'rizky@cnt.id',    '$2b$12$xxx', 'supervisor'),
( 4, 'Sari Rahmawati',    'sari@rn.org',     '$2b$12$xxx', 'data_analyst'),
( 5, 'Dian Kusuma',       'dian@rn.org',     '$2b$12$xxx', 'data_analyst'),
( 6, 'Budi Santoso',      'budi@rn.org',     '$2b$12$xxx', 'tim_blast'),
( 7, 'Rina Dewi',         'rina@rn.org',     '$2b$12$xxx', 'tim_blast'),
( 8, 'Ahmad Fauzi',       'ahmad@rn.org',    '$2b$12$xxx', 'tim_blast'),
( 9, 'Lestari Wulandari', 'lestari@rn.org',  '$2b$12$xxx', 'tim_blast'),
(10, 'Hendra Gunawan',    'hendra@rn.org',   '$2b$12$xxx', 'tim_blast'),
(11, 'Fitriani Noor',     'fitri@rn.org',    '$2b$12$xxx', 'tim_blast'),
(12, 'Viewer Only',       'viewer@rn.org',   '$2b$12$xxx', 'read_only');

-- ============================================================
-- USER_TOKENS
-- ============================================================
INSERT INTO user_tokens (user_id, token_hash, source, label, expires_at) VALUES
(6,  'hash_ext_budi',    'chrome_extension', 'Laptop Budi',         NULL),
(7,  'hash_ext_rina',    'chrome_extension', 'Laptop Rina',         NULL),
(8,  'hash_ext_ahmad',   'chrome_extension', 'Laptop Ahmad',        NULL),
(9,  'hash_ext_lestari', 'chrome_extension', 'PC Lestari',          NULL),
(4,  'hash_api_sari',    'api_key',          'Import Scripts',      NULL),
(2,  'hash_web_regi',    'web_session',      NULL,                  now() + interval '8 hours');

-- ============================================================
-- PROGRAMS (master program donasi)
-- id ditetapkan eksplisit agar FK di transactions bisa di-seed
-- slug immutable — dipakai sebagai key di program_participation
-- ============================================================
INSERT INTO programs (id, slug, nama, deskripsi, kategori, periode_mulai, periode_selesai, is_active, sort_order, created_by) VALUES
(1,  'ramadan',       'Ramadan',             'Program donasi bulan Ramadan',                      'seasonal',   NULL, NULL, TRUE,  1, 1),
(2,  'qurban',        'Qurban',              'Program ibadah qurban Idul Adha',                   'seasonal',   NULL, NULL, TRUE,  2, 1),
(3,  'zakat_fitrah',  'Zakat Fitrah',        'Zakat fitrah akhir Ramadan',                        'zakat',      NULL, NULL, TRUE,  3, 1),
(4,  'zakat_mal',     'Zakat Mal',           'Zakat harta/penghasilan',                           'zakat',      NULL, NULL, TRUE,  4, 1),
(5,  'wakaf',         'Wakaf',               'Program wakaf produktif',                           'wakaf',      NULL, NULL, TRUE,  5, 1),
(6,  'anak_yatim',    'Anak Yatim',          'Santunan anak yatim dan dhuafa',                    'reguler',    NULL, NULL, TRUE,  6, 1),
(7,  'bencana_alam',  'Bencana Alam',        'Donasi darurat bencana alam',                       'emergency',  NULL, NULL, TRUE,  7, 1),
(8,  'beasiswa',      'Beasiswa',            'Beasiswa pendidikan',                               'reguler',    NULL, NULL, TRUE,  8, 1),
(9,  'infaq',         'Infaq & Sedekah',     'Infaq dan sedekah harian/mingguan',                 'reguler',    NULL, NULL, TRUE,  9, 1),
(10, 'muharram',      'Muharram',            'Program khusus bulan Muharram (1 Muharam)',          'seasonal',   NULL, NULL, TRUE, 10, 1);

-- ============================================================
-- CAMPAIGNS (master campaign blast)
-- ============================================================
INSERT INTO campaigns (id, slug, nama, deskripsi, program_id, tipe, tgl_mulai, tgl_selesai, is_active, created_by) VALUES
-- Ramadan 2023
(1,  'ramadan_2023',          'Ramadan 2023',             'Campaign donasi Ramadan 1444H',        1, 'seasonal',     '2023-03-01','2023-04-30', TRUE, 4),
-- Qurban 2023
(2,  'qurban_2023',           'Qurban 2023',              'Campaign qurban Idul Adha 1444H',      2, 'seasonal',     '2023-05-01','2023-07-31', TRUE, 4),
-- Ramadan 2024
(3,  'ramadan_2024',          'Ramadan 2024',             'Campaign donasi Ramadan 1445H',        1, 'seasonal',     '2024-03-01','2024-04-30', TRUE, 4),
-- Qurban 2024
(4,  'qurban_2024',           'Qurban 2024',              'Campaign qurban Idul Adha 1445H',      2, 'seasonal',     '2024-05-01','2024-07-31', TRUE, 4),
-- Zakat Fitrah 2024
(5,  'zakat_fitrah_2024',     'Zakat Fitrah 2024',        'Zakat fitrah Ramadan 1445H',           3, 'seasonal',     '2024-03-15','2024-04-09', TRUE, 4),
-- Zakat Mal 2024
(6,  'zakat_mal_2024',        'Zakat Mal Akhir 2024',     'Zakat mal tutup tahun 2024',           4, 'seasonal',     '2024-12-01','2024-12-31', TRUE, 5),
-- Muharram 2024
(7,  'muharram_2024',         'Muharram 2024',            'Santunan anak yatim 10 Muharram',      10,'seasonal',    '2024-07-01','2024-09-30', TRUE, 4),
-- Wakaf Produktif
(8,  'wakaf_produktif',       'Wakaf Produktif',          'Campaign wakaf sepanjang tahun',        5, 'blast',        '2023-01-01', NULL,        TRUE, 4),
-- Re-engagement Q4 2025
(9,  'reengagement_q4_2025', 'Re-engagement At Risk Q4', 'Campaign khusus donatur at_risk Q4',   NULL,'reengagement','2025-10-01','2025-12-31', TRUE, 2),
-- Ramadan 2025
(10, 'ramadan_2025',          'Ramadan 2025',             'Campaign donasi Ramadan 1446H',        1, 'seasonal',     '2025-02-28','2025-04-30', TRUE, 4),
-- Qurban 2025 Early Bird
(11, 'qurban_2025_early',     'Qurban 2025 Early Bird',   'Pre-order qurban 1446H',               2, 'seasonal',     '2025-04-01','2025-06-30', TRUE, 5),
-- Zakat Mal 2025
(12, 'zakat_mal_2025',        'Zakat Mal 2025',           'Zakat mal tahun 2025',                 4, 'seasonal',     '2025-03-01','2025-04-30', TRUE, 4),
-- Akhir Tahun Zakat Mal 2025
(13, 'zakat_mal_akhir_2025',  'Zakat Mal Akhir 2025',     'Zakat mal tutup tahun 2025',           4, 'seasonal',     '2025-12-01','2025-12-31', TRUE, 5),
-- Ramadan 2026
(14, 'ramadan_2026',          'Ramadan 2026',             'Campaign donasi Ramadan 1447H',        1, 'seasonal',     '2026-02-18','2026-04-30', TRUE, 4),
-- Qurban 2026
(15, 'qurban_2026',           'Qurban 2026',              'Campaign qurban Idul Adha 1447H',      2, 'seasonal',     '2026-04-01','2026-07-31', TRUE, 4),
-- Onboarding Donatur Baru
(16, 'onboarding_new',        'Onboarding Donatur Baru',  'Campaign perkenalan untuk new donor',  NULL,'onboarding', NULL,         NULL,        TRUE, 2),
-- Bencana Alam 2026
(17, 'bencana_alam_2026',     'Darurat Bencana 2026',     'Donasi darurat bencana alam 2026',     7, 'blast',        '2026-01-01', NULL,        TRUE, 4),
-- Beasiswa 2026
(18, 'beasiswa_2026',         'Beasiswa 2026',            'Campaign beasiswa pendidikan',          8, 'blast',        '2026-01-01', NULL,        TRUE, 4),
-- Wakaf 2025
(19, 'wakaf_2025',            'Wakaf 2025',               'Campaign wakaf 2025',                   5, 'blast',        '2025-01-01','2025-12-31', TRUE, 4);

-- ============================================================
-- VENDOR PROFILES
-- ============================================================
INSERT INTO vendor_profiles (id, nama_vendor, column_mapping, status_mapping, is_default, created_by) VALUES
(1, 'Wappin v2',
 '{"no_hp":"Phone Number","status":"Delivery Status","dibaca":"Read","respon":"Response"}',
 '{"Delivered":"terkirim","Read":"terkirim","Failed":"nomor_mati",
   "Blocked":"diblokir","Unregistered":"tidak_terdaftar","Rate Limited":"gagal_limit"}',
 TRUE, 1),
(2, 'Mekari Qontak',
 '{"no_hp":"destination","status":"message_status","dibaca":"is_read"}',
 '{"sent":"terkirim","delivered":"terkirim","read":"terkirim",
   "failed":"nomor_mati","rejected":"diblokir","ratelimited":"gagal_limit"}',
 FALSE, 1),
(3, 'Cekat AI',
 '{"no_hp":"whatsapp_number","status":"send_status","dibaca":"read_status"}',
 '{"SUCCESS":"terkirim","FAILED":"nomor_mati","BLOCKED":"diblokir",
   "LIMIT":"gagal_limit","NOT_WA":"tidak_terdaftar"}',
 FALSE, 1);

-- ============================================================
-- FIELD DEFINITIONS (7 dynamic field)
-- ============================================================
INSERT INTO field_definitions
    (id, slug, label, tipe, options_json,
     is_required, is_searchable, visible_in_json, editable_by_json,
     sort_order, is_active, created_by)
VALUES
(1,'wilayah_donatur','Wilayah Donatur','dropdown',
 '[{"value":"jabodetabek","label":"Jabodetabek"},
   {"value":"jawa_barat","label":"Jawa Barat"},
   {"value":"jawa_tengah","label":"Jawa Tengah"},
   {"value":"jawa_timur","label":"Jawa Timur"},
   {"value":"sumatera","label":"Sumatera"},
   {"value":"kalimantan","label":"Kalimantan"},
   {"value":"sulawesi","label":"Sulawesi"},
   {"value":"bali_ntt_ntb","label":"Bali/NTT/NTB"},
   {"value":"papua_maluku","label":"Papua & Maluku"},
   {"value":"luar_negeri","label":"Luar Negeri"}]',
 FALSE,TRUE,'["profil","list","export"]','["admin","supervisor","data_analyst","tim_blast"]',1,TRUE,1),

(2,'preferensi_program','Preferensi Program Donasi','multiselect',
 '[{"value":"ramadan","label":"Ramadan"},
   {"value":"qurban","label":"Qurban"},
   {"value":"zakat_fitrah","label":"Zakat Fitrah"},
   {"value":"zakat_mal","label":"Zakat Mal"},
   {"value":"wakaf","label":"Wakaf"},
   {"value":"anak_yatim","label":"Anak Yatim"},
   {"value":"bencana_alam","label":"Bencana Alam"},
   {"value":"beasiswa","label":"Beasiswa"}]',
 FALSE,TRUE,'["profil","list","export"]','["admin","supervisor","data_analyst","tim_blast"]',2,TRUE,1),

(3,'profesi','Profesi / Pekerjaan','dropdown',
 '[{"value":"pegawai_negeri","label":"PNS/ASN"},
   {"value":"pegawai_swasta","label":"Pegawai Swasta"},
   {"value":"wirausaha","label":"Wirausaha"},
   {"value":"profesional","label":"Profesional"},
   {"value":"ibu_rumah_tangga","label":"Ibu Rumah Tangga"},
   {"value":"mahasiswa","label":"Mahasiswa"},
   {"value":"pensiunan","label":"Pensiunan"},
   {"value":"lainnya","label":"Lainnya"}]',
 FALSE,TRUE,'["profil","export"]','["admin","supervisor","data_analyst"]',3,TRUE,1),

(4,'status_donatur_tetap','Donatur Tetap / Rutin','boolean',
 '[]',FALSE,TRUE,'["profil","list","export"]','["admin","supervisor","data_analyst"]',4,TRUE,1),

(5,'channel_akuisisi','Channel Pertama Kenal RN','dropdown',
 '[{"value":"media_sosial","label":"Media Sosial"},
   {"value":"whatsapp","label":"WhatsApp Broadcast"},
   {"value":"website","label":"Website/Donol"},
   {"value":"rekomendasi","label":"Rekomendasi"},
   {"value":"event","label":"Event Offline"},
   {"value":"youtube","label":"YouTube"},
   {"value":"tidak_diketahui","label":"Tidak Diketahui"}]',
 FALSE,TRUE,'["profil","export"]','["admin","supervisor","data_analyst"]',5,TRUE,1),

(6,'catatan_internal','Catatan Internal (Admin)','text',
 '[]',FALSE,FALSE,'["profil"]','["admin","supervisor"]',6,TRUE,1),

(7,'tgl_onboarding_crm','Tanggal Onboarding CRM','date',
 '[]',FALSE,TRUE,'["profil","export"]','["admin","supervisor","data_analyst"]',7,TRUE,1);

-- ============================================================
-- DONORS (25 donatur)
-- last_donation_program_id = FK ke programs(id)
-- ============================================================
INSERT INTO donors (
    id, no_hp_canonical, no_hp_variants, nama_lengkap, email,
    tgl_registrasi, sumber_registrasi, linked_zains_ids, zains_id_primer,
    status_kontak, segmen_rfm, skor_r, skor_f, skor_m, tags,
    assigned_to, follow_up_status, follow_up_due_date,
    last_donation_at, last_donation_nominal, last_donation_program_id,
    total_donation_lifetime, total_donation_count
) VALUES
-- CHAMPIONS ──────────────────────────────────────────────────
(1, '6281234567890','{"081234567890","6281234567890"}',
 'Budi Rahmat Santoso','budi.rahmat@email.com','2022-01-15','zains',
 '{"ZN-001234"}','ZN-001234','aktif','champions',5,5,5,
 '{"prioritas","loyal"}',6,'in_progress','2026-04-20',
 '2025-03-15',500000,1,4250000,12),           -- program_id=1 (ramadan)

(2, '6285678901234','{"085678901234"}',
 'Dewi Anggraeni Putri','dewi.anggraeni@gmail.com','2021-08-20','cf',
 '{"ZN-002345"}','ZN-002345','aktif','champions',5,5,5,
 '{"prioritas","qurban_rutin"}',7,'waiting_callback','2026-04-18',
 '2025-03-10',1000000,1,8750000,18),          -- program_id=1 (ramadan)

(3, '6287890123456','{"087890123456","6287890123456"}',
 'Hendra Wijaksono','hendra.w@company.co.id','2020-03-10','zains',
 '{"ZN-003456","ZN-003457"}','ZN-003456','aktif','champions',4,5,5,
 '{"high_value","wakaf"}',8,NULL,NULL,
 '2025-06-01',2000000,5,15200000,24),         -- program_id=5 (wakaf)

-- LOYAL ───────────────────────────────────────────────────────
(4, '6282345678901','{"082345678901"}',
 'Siti Nurhaliza Rahmah','siti.nurhaliza@yahoo.com','2022-06-01','cf',
 '{"ZN-004567"}','ZN-004567','aktif','loyal',4,4,4,
 '{"loyal","ramadan_rutin"}',6,'in_progress','2026-04-25',
 '2025-03-20',300000,1,2800000,10),           -- program_id=1 (ramadan)

(5, '6289012345678','{"089012345678"}',
 'Rizal Fahmi Harahap','rizal.fahmi@gmail.com','2021-11-15','zains',
 '{"ZN-005678"}','ZN-005678','aktif','loyal',4,4,3,
 '{"loyal"}',7,NULL,NULL,
 '2025-04-05',750000,4,5100000,9),            -- program_id=4 (zakat_mal)

(6, '6281122334455','{"081122334455"}',
 'Fatimah Zahra Nasution','fatimah.zahra@email.com','2022-02-28','cf',
 '{"ZN-006789"}','ZN-006789','aktif','loyal',5,4,3,
 '{"loyal","ibu_rt"}',8,NULL,NULL,
 '2025-05-12',500000,6,3600000,11),           -- program_id=6 (anak_yatim)

-- POTENTIAL ───────────────────────────────────────────────────
(7, '6285544332211','{"085544332211"}',
 'Agus Setiawan Prabowo','agus.setiawan@email.com','2023-01-10','upload',
 '{"ZN-007890"}','ZN-007890','aktif','potential',4,3,3,
 '{}',9,NULL,NULL,
 '2025-04-20',200000,1,1200000,5),            -- program_id=1 (ramadan)

(8, '6288776655443','{"088776655443"}',
 'Nurul Hidayah Wahab','nurul.hidayah@gmail.com','2023-03-22','cf',
 '{"ZN-008901"}','ZN-008901','aktif','potential',3,3,2,
 '{}',10,NULL,NULL,
 '2025-03-28',150000,7,850000,4),             -- program_id=7 (bencana_alam)

(9, '6283321098765','{"083321098765"}',
 'Teguh Santoso Haryono','teguh.santoso@email.com','2022-09-05','zains',
 '{"ZN-009012"}','ZN-009012','aktif','potential',3,2,3,
 '{}',11,NULL,NULL,
 '2025-02-14',250000,2,950000,3),             -- program_id=2 (qurban)

-- AT RISK ─────────────────────────────────────────────────────
-- Donor 10: Ramadan 2024 & 2025 TIDAK ADA → usecase query temporal
(10,'6286655443322','{"086655443322"}',
 'Indah Permatasari','indah.permata@gmail.com','2020-07-14','zains',
 '{"ZN-010123"}','ZN-010123','aktif','at_risk',2,4,4,
 '{"perlu_reengagement"}',6,'in_progress','2026-04-15',
 '2024-10-20',500000,2,3800000,14),           -- program_id=2 (qurban)

-- Donor 11: Wakaf aktif, tidak Ramadan 2024/2025
(11,'6289988776655','{"089988776655","6289988776655"}',
 'Bambang Eko Prasetyo','bambang.eko@yahoo.com','2021-02-18','cf',
 '{"ZN-011234","ZN-011235"}','ZN-011234','aktif','at_risk',2,3,4,
 '{"perlu_reengagement","high_value"}',7,'waiting_callback','2026-04-17',
 '2024-09-15',750000,5,6200000,15),           -- program_id=5 (wakaf)

-- Donor 12: Ex-champion, Qurban rutin, tidak Ramadan 2024/2025
(12,'6281098765432','{"081098765432"}',
 'Yanti Sulistyowati','yanti.sulis@email.com','2019-12-01','zains',
 '{"ZN-012345"}','ZN-012345','aktif','at_risk',1,5,5,
 '{"perlu_reengagement","champion_lama"}',8,'in_progress','2026-04-12',
 '2024-06-20',1000000,2,12400000,22),         -- program_id=2 (qurban)

-- NEW ─────────────────────────────────────────────────────────
(13,'6282211009988','{"082211009988"}',
 'Andi Firmansyah','andi.firmansyah@email.com','2026-02-10','cf',
 '{"ZN-013456"}','ZN-013456','aktif','new',5,1,2,
 '{"new_donor"}',9,NULL,NULL,
 '2026-03-01',100000,7,200000,2),             -- program_id=7 (bencana_alam)

(14,'6285533221100','{"085533221100"}',
 'Lia Septiani Kurniawan','lia.septiani@gmail.com','2026-01-20','upload',
 '{"ZN-014567"}','ZN-014567','aktif','new',5,1,1,
 '{"new_donor"}',10,NULL,NULL,
 '2026-01-25',50000,8,50000,1),               -- program_id=8 (beasiswa)

(15,'6287766554433','{"087766554433"}',
 'Rendra Pratama','rendra.pratama@email.com','2026-03-05','cf',
 '{"ZN-015678"}','ZN-015678','aktif','new',5,1,2,
 '{"new_donor"}',11,NULL,NULL,
 '2026-03-15',200000,5,400000,2),             -- program_id=5 (wakaf)

-- ONE_TIME ────────────────────────────────────────────────────
(16,'6283344556677','{"083344556677"}',
 'Desi Ratnasari','desi.ratna@yahoo.com','2024-03-10','cf',
 '{"ZN-016789"}','ZN-016789','aktif','one_time',3,1,2,
 '{}',6,NULL,NULL,
 '2024-03-20',100000,1,100000,1),             -- program_id=1 (ramadan)

(17,'6286677889900','{"086677889900"}',
 'Fajar Nugroho Wibowo','fajar.nugroho@email.com','2024-06-15','zains',
 '{"ZN-017890"}','ZN-017890','aktif','one_time',2,1,1,
 '{}',7,NULL,NULL,
 '2024-07-10',75000,2,75000,1),               -- program_id=2 (qurban)

-- LOST ────────────────────────────────────────────────────────
(18,'6281234500000','{"081234500000"}',
 'Gunawan Saputra','gunawan.saputra@email.com','2019-05-20','zains',
 '{"ZN-018901"}','ZN-018901','aktif','lost',1,1,1,
 '{}',NULL,NULL,NULL,
 '2022-01-10',200000,1,1500000,7),            -- program_id=1 (ramadan)

(19,'6285599887766','{"085599887766"}',
 'Wulandari Prasetyo',NULL,'2020-09-15','upload',
 '{"ZN-019012"}','ZN-019012','aktif','lost',1,2,1,
 '{}',NULL,NULL,NULL,
 '2022-06-05',150000,2,600000,4),             -- program_id=2 (qurban)

-- STATUS KHUSUS ───────────────────────────────────────────────
(20,'6287788990011','{"087788990011"}',
 'Riko Maulana','riko.maulana@gmail.com','2022-04-01','cf',
 '{"ZN-020123"}','ZN-020123','mati',NULL,NULL,NULL,NULL,
 '{}',NULL,NULL,NULL,NULL,NULL,NULL,500000,3),

(21,'6281199887766','{"081199887766"}',
 'Sri Lestari','sri.lestari@email.com','2021-10-20','zains',
 '{"ZN-021234"}','ZN-021234','diblokir',NULL,NULL,NULL,NULL,
 '{}',NULL,NULL,NULL,
 '2024-01-15',300000,1,1200000,4),            -- program_id=1 (ramadan)

(22,'6289900112233','{"089900112233"}',
 'Pak Hartono','hartono.bpk@email.com','2020-01-10','zains',
 '{"ZN-022345"}','ZN-022345','opt_out',NULL,NULL,NULL,NULL,
 '{}',NULL,NULL,NULL,
 '2023-12-25',500000,3,3000000,8),            -- program_id=3 (zakat_fitrah)

-- MERGED 3 IDs ────────────────────────────────────────────────
(23,'6284455667788','{"084455667788","6284455667788","04455667788"}',
 'Kurniawan Effendi','kurniawan.e@email.com','2021-06-12','zains',
 '{"ZN-023456","ZN-023457","ZN-023458"}','ZN-023456','aktif','loyal',4,4,4,
 '{"merged_3_ids"}',8,NULL,NULL,
 '2025-05-20',400000,1,4800000,12),           -- program_id=1 (ramadan)

-- OVERDUE ─────────────────────────────────────────────────────
(24,'6281357924680','{"081357924680"}',
 'Maya Sari Dewi','maya.sari@email.com','2022-08-08','cf',
 '{"ZN-024567"}','ZN-024567','aktif','at_risk',2,3,3,
 '{"overdue_followup"}',9,'in_progress','2026-03-01',
 '2024-12-10',250000,6,1750000,7),            -- program_id=6 (anak_yatim)

-- UNASSIGNED ──────────────────────────────────────────────────
(25,'6289753186420','{"089753186420"}',
 'Doni Hermawan','doni.hermawan@gmail.com','2023-07-25','upload',
 '{"ZN-025678"}','ZN-025678','aktif','potential',3,2,2,
 '{}',NULL,NULL,NULL,
 '2025-01-15',100000,8,300000,3);             -- program_id=8 (beasiswa)

-- ============================================================
-- TRANSACTIONS
-- program_id = FK ke programs(id)
-- campaign_id = FK ke campaigns(id) — opsional
-- ============================================================
INSERT INTO transactions
    (id, donor_id, program_id, campaign_id,
     id_transaksi_zains, tgl_transaksi, bulan_program,
     nominal, status, sumber)
VALUES
-- Budi (1): ramadan 2023-2025, qurban 2023-2024, anak yatim, zakat fitrah
(1, 1,1,1,  'TRX-0001','2023-03-25','2023-03', 300000,'paid','zains'),  -- ramadan / camp=ramadan_2023
(2, 1,2,2,  'TRX-0002','2023-06-28','2023-06', 500000,'paid','zains'),  -- qurban  / camp=qurban_2023
(3, 1,1,3,  'TRX-0003','2024-03-18','2024-03', 400000,'paid','zains'),  -- ramadan / camp=ramadan_2024
(4, 1,2,4,  'TRX-0004','2024-06-15','2024-06', 500000,'paid','zains'),  -- qurban  / camp=qurban_2024
(5, 1,6,7,  'TRX-0005','2024-10-10','2024-10', 150000,'paid','zains'),  -- anak_yatim / camp=muharram_2024
(6, 1,3,5,  'TRX-0006','2024-12-25','2024-12', 100000,'paid','zains'),  -- zakat_fitrah / camp=zakat_fitrah_2024
(7, 1,1,10, 'TRX-0007','2025-03-15','2025-03', 500000,'paid','zains'),  -- ramadan / camp=ramadan_2025
-- Dewi (2): high value
(8, 2,1,1,  'TRX-0008','2022-04-05','2022-04', 500000,'paid','cf'),
(9, 2,2,2,  'TRX-0009','2022-07-09','2022-07',1000000,'paid','cf'),
(10,2,1,1,  'TRX-0010','2023-03-28','2023-03', 500000,'paid','cf'),
(11,2,2,2,  'TRX-0011','2023-06-27','2023-06',1000000,'paid','cf'),
(12,2,1,3,  'TRX-0012','2024-03-17','2024-03', 750000,'paid','cf'),
(13,2,2,4,  'TRX-0013','2024-06-17','2024-06',1000000,'paid','cf'),
(14,2,4,6,  'TRX-0014','2024-12-20','2024-12',2000000,'paid','cf'),     -- zakat_mal / camp=zakat_mal_2024
(15,2,1,10, 'TRX-0015','2025-03-10','2025-03',1000000,'paid','cf'),
-- Hendra (3): wakaf besar + ramadan
(16,3,1,1,  'TRX-0016','2021-03-20','2021-03',1000000,'paid','zains'),
(17,3,2,2,  'TRX-0017','2021-07-20','2021-07',2000000,'paid','zains'),
(18,3,1,1,  'TRX-0018','2022-03-15','2022-03',1000000,'paid','zains'),
(19,3,5,8,  'TRX-0019','2023-01-10','2023-01',2000000,'paid','zains'),  -- wakaf / camp=wakaf_produktif
(20,3,1,3,  'TRX-0020','2024-03-20','2024-03',1000000,'paid','zains'),
(21,3,5,19, 'TRX-0021','2025-06-01','2025-06',2000000,'paid','zains'),  -- wakaf / camp=wakaf_2025
-- Siti (4): ramadan rutin
(22,4,1,1,  'TRX-0022','2023-03-22','2023-03', 200000,'paid','cf'),
(23,4,2,2,  'TRX-0023','2023-06-30','2023-06', 300000,'paid','cf'),
(24,4,1,3,  'TRX-0024','2024-03-15','2024-03', 250000,'paid','cf'),
(25,4,1,10, 'TRX-0025','2025-03-20','2025-03', 300000,'paid','cf'),
-- Rizal (5): ramadan + zakat mal
(26,5,1,1,  'TRX-0026','2022-03-10','2022-03', 500000,'paid','zains'),
(27,5,2,2,  'TRX-0027','2022-07-10','2022-07', 750000,'paid','zains'),
(28,5,1,1,  'TRX-0028','2023-03-25','2023-03', 500000,'paid','zains'),
(29,5,4,12, 'TRX-0029','2025-04-05','2025-04', 750000,'paid','zains'),  -- zakat_mal / camp=zakat_mal_2025
-- Indah (10): AT RISK — Ramadan 2024/2025 TIDAK ADA
(30,10,1,1, 'TRX-0030','2022-03-28','2022-03', 300000,'paid','zains'),
(31,10,2,2, 'TRX-0031','2022-07-10','2022-07', 500000,'paid','zains'),
(32,10,1,1, 'TRX-0032','2023-04-02','2023-04', 300000,'paid','zains'),  -- ramadan 2023 terakhir!
(33,10,2,2, 'TRX-0033','2023-06-29','2023-06', 500000,'paid','zains'),
(34,10,2,4, 'TRX-0034','2024-10-20','2024-10', 500000,'paid','zains'),  -- qurban 2024 ada, ramadan tidak
-- Yanti (12): AT RISK ex-champion — Qurban rutin, Ramadan 2024/2025 TIDAK ADA
(35,12,1,1, 'TRX-0035','2020-04-25','2020-04', 500000,'paid','zains'),
(36,12,2,2, 'TRX-0036','2020-07-31','2020-07',1000000,'paid','zains'),
(37,12,1,1, 'TRX-0037','2021-04-15','2021-04', 500000,'paid','zains'),
(38,12,2,2, 'TRX-0038','2022-07-10','2022-07',1000000,'paid','zains'),
(39,12,1,1, 'TRX-0039','2023-03-30','2023-03', 500000,'paid','zains'),  -- ramadan 2023 terakhir!
(40,12,2,4, 'TRX-0040','2024-06-20','2024-06',1000000,'paid','zains'),  -- qurban 2024 ada, ramadan tidak
-- Gunawan (18): LOST — terakhir 2022
(41,18,1,1, 'TRX-0041','2020-04-28','2020-04', 200000,'paid','zains'),
(42,18,1,1, 'TRX-0042','2021-04-14','2021-04', 200000,'paid','zains'),
(43,18,2,2, 'TRX-0043','2021-07-20','2021-07', 300000,'paid','zains'),
(44,18,1,1, 'TRX-0044','2022-01-10','2022-01', 200000,'paid','zains'),
-- Bambang (11): AT RISK — wakaf aktif, tidak Ramadan 2024/2025
(45,11,1,1, 'TRX-0045','2021-04-20','2021-04', 500000,'paid','cf'),
(46,11,2,2, 'TRX-0046','2022-07-10','2022-07', 750000,'paid','cf'),
(47,11,5,8, 'TRX-0047','2022-12-15','2022-12',1000000,'paid','cf'),
(48,11,2,2, 'TRX-0048','2023-07-01','2023-07', 750000,'paid','cf'),
(49,11,5,19,'TRX-0049','2024-09-15','2024-09', 750000,'paid','cf'),     -- wakaf / camp=wakaf_2025
-- Checkout/pending
(50,7, 2,15,NULL,'2026-04-01','2026-04', 300000,'checkout','cf'),       -- qurban 2026
(51,8, 2,15,NULL,'2026-04-02','2026-04', 200000,'pending', 'cf'),
-- Andi (13): paid Ramadan 2026
(52,13,7,17,NULL,'2026-03-01','2026-03', 100000,'paid','cf'),           -- bencana_alam awal
(53,13,1,14,NULL,'2026-04-10','2026-04', 100000,'paid','cf');           -- ramadan 2026

-- ============================================================
-- BLAST BATCHES (linked ke campaign)
-- ============================================================
INSERT INTO blast_batches
    (id, campaign_id, vendor_profile_id, tgl_blast,
     jumlah_target, jumlah_terkirim, jumlah_gagal,
     jumlah_dibaca, jumlah_respon, jumlah_closing,
     import_status, diimport_oleh)
VALUES
(1, 10,1,'2025-03-01', 9800, 8920, 880,3120,450,72,'done',4),   -- ramadan_2025 G1
(2, 10,1,'2025-03-15', 9500, 8640, 860,2980,380,55,'done',4),   -- ramadan_2025 G2
(3, 11,2,'2025-05-01',12000,10800,1200,3800,620,88,'done',5),   -- qurban_2025_early
(4,  9,1,'2025-10-10', 5000, 4350, 650,1100,180,22,'done',4),   -- reengagement_q4_2025
(5, 13,3,'2025-12-01', 8000, 7100, 900,2200,310,41,'done',5),   -- zakat_mal_akhir_2025
(6, 15,1,'2026-04-01', 1000,  900, 100, 280, 45, 8,'done',4);   -- qurban_2026

-- ============================================================
-- BLAST RECORDS
-- ============================================================
INSERT INTO blast_records
    (id, donor_id, blast_batch_id, tgl_kirim,
     status_kirim, dibaca, respon, raw_vendor_status)
VALUES
-- Batch 1: Ramadan 2025 G1
(1, 1, 1,'2025-03-01 07:15:00+07','terkirim',     TRUE, 'closing',    'READ'),
(2, 2, 1,'2025-03-01 09:30:00+07','terkirim',     TRUE, 'merespon',   'DELIVERED'),
(3, 4, 1,'2025-03-01 07:20:00+07','terkirim',     TRUE, 'closing',    'READ'),
(4, 5, 1,'2025-03-01 09:35:00+07','terkirim',     FALSE,'belum',      'DELIVERED'),
-- Donor 10: di-blast Ramadan 2025 TAPI tidak donasi → query temporal
(5, 10,1,'2025-03-01 07:25:00+07','terkirim',     TRUE, 'hanya_read', 'READ'),
(6, 11,1,'2025-03-01 09:40:00+07','terkirim',     TRUE, 'merespon',   'READ'),
(7, 12,1,'2025-03-01 07:30:00+07','terkirim',     TRUE, 'hanya_read', 'READ'),
(8, 16,1,'2025-03-01 09:45:00+07','nomor_mati',   NULL, 'belum',      'FAILED'),
(9, 20,1,'2025-03-01 07:35:00+07','nomor_mati',   NULL, 'belum',      'FAILED'),
-- Batch 3: Qurban 2025 Early Bird
(10,1, 3,'2025-05-01 07:00:00+07','terkirim',     TRUE, 'merespon',   'READ'),
(11,2, 3,'2025-05-01 09:00:00+07','terkirim',     TRUE, 'closing',    'READ'),
(12,3, 3,'2025-05-01 07:05:00+07','terkirim',     TRUE, 'closing',    'READ'),
(13,10,3,'2025-05-01 09:05:00+07','terkirim',     FALSE,'belum',      'DELIVERED'),
(14,11,3,'2025-05-01 07:10:00+07','terkirim',     TRUE, 'hanya_read', 'READ'),
-- Donor 21 memblokir
(15,21,3,'2025-05-01 07:15:00+07','diblokir',     NULL, 'memblokir',  'BLOCKED'),
-- Batch 4: Re-engagement
(16,10,4,'2025-10-10 08:00:00+07','terkirim',     TRUE, 'merespon',   'READ'),
(17,11,4,'2025-10-10 10:00:00+07','terkirim',     TRUE, 'merespon',   'READ'),
(18,12,4,'2025-10-10 08:05:00+07','terkirim',     FALSE,'belum',      'DELIVERED'),
(19,18,4,'2025-10-10 10:05:00+07','nomor_mati',   NULL, 'belum',      'FAILED'),
-- Batch 6: Qurban 2026
(20,1, 6,'2026-04-01 07:00:00+07','terkirim',     TRUE, 'closing',    'READ'),
(21,2, 6,'2026-04-01 09:00:00+07','terkirim',     TRUE, 'merespon',   'READ'),
(22,7, 6,'2026-04-01 07:05:00+07','gagal_limit',  NULL, 'belum',      'Rate Limited'),
(23,22,6,'2026-04-01 09:05:00+07','tidak_terdaftar',NULL,'belum',     'NOT_WA');

-- ============================================================
-- PROSPECT NOTES (linked ke campaigns)
-- ============================================================
INSERT INTO prospect_notes
    (id, donor_id, user_id, campaign_id, tgl_prospek,
     channel, respon_donatur, catatan_bebas, source)
VALUES
(1, 1, 6,10,'2025-03-02','wappin',          'closing',
 'Transfer langsung. Mau lanjut Qurban.','web_app'),
(2, 1, 6,11,'2025-05-05','web_whatsapp_ext','merespon',
 'Tertarik qurban, minta info rekening.','chrome_extension'),
(3, 1, 6,15,'2026-04-02','web_whatsapp_ext','closing',
 'Transfer 500rb qurban 2026.','chrome_extension'),
(4, 2, 7,10,'2025-03-02','wappin',          'closing',
 'Donasi 1 juta. Tanya infaq harian.','web_app'),
(5, 2, 7,15,'2026-04-03','web_whatsapp_ext','merespon',
 'Tertarik, minta diingatkan H-7.','chrome_extension'),
(6, 10,6,10,'2025-03-05','wappin',          'hanya_read',
 'Dibaca tidak dibalas.','web_app'),
(7, 10,6, 9,'2025-10-15','mekari',          'merespon',
 '"Insyaallah ya" belum ada transfer.','web_app'),
(8, 10,9,15,'2026-04-10','web_whatsapp_ext','belum_merespon',
 'WA Chrome Extension terkirim, belum respons.','chrome_extension'),
(9, 11,7,10,'2025-03-06','wappin',          'merespon',
 'Janji minggu depan, tidak terealisasi.','web_app'),
(10,11,7, 9,'2025-10-18','mekari',          'merespon',
 'Minta info Wakaf. Brosur dikirim.','web_app'),
(11,12,8,10,'2025-03-08','wappin',          'hanya_read',
 'Dibaca tidak dibalas.','web_app'),
(12,12,8, 9,'2025-10-20','mekari',          'belum_merespon',
 'Tidak ada respons.','web_app'),
(13,24,9,15,'2026-02-15','wappin',          'merespon',
 'Minta callback. Belum dihubungi. OVERDUE.','web_app'),
(14,13,10,16,'2026-03-05','web_whatsapp_ext','merespon',
 'Donor baru CF. Perkenalkan program RN.','chrome_extension'),
(15,23,8,10,'2025-04-10','wappin',          'closing',
 'Donasi 400rb. 3 ID ZAINS sudah di-merge.','web_app');

-- ============================================================
-- SAVED SEGMENTS
-- ============================================================
INSERT INTO saved_segments
    (id, nama, deskripsi, query_json,
     is_public, auto_refresh, refresh_schedule, last_count, dibuat_oleh)
VALUES
(1,'Qurban 2024 — Belum Qurban 2025',
 'Qurban program_id=2 di 2024-Q2 tapi belum 2025-Q2',
 '{"operator":"AND",
   "conditions":[
     {"type":"program_participation","program_slug":"qurban","period":"2024-Q2","op":"in"},
     {"type":"status_kontak","value":"aktif"}],
   "not_conditions":[
     {"type":"program_participation","program_slug":"qurban","period":"2025-Q2","op":"in"}]}',
 TRUE,TRUE,'weekly',847,4),

(2,'Ramadan 2025 — Belum Donasi Sesudahnya',
 'Ramadan 2025-Q1 ada tapi last_donation_date < Juni 2025',
 '{"operator":"AND",
   "conditions":[
     {"type":"program_participation","program_slug":"ramadan","period":"2025-Q1","op":"in"},
     {"type":"status_kontak","value":"aktif"}],
   "not_conditions":[
     {"type":"last_donation_date","op":">=","value":"2025-06-01"}]}',
 TRUE,TRUE,'weekly',1243,4),

(3,'At Risk High Value',
 'at_risk + lifetime > 3jt + aktif',
 '{"operator":"AND",
   "conditions":[
     {"type":"segmen_rfm","value":"at_risk"},
     {"type":"total_donation_lifetime","op":">=","value":3000000},
     {"type":"status_kontak","value":"aktif"}],
   "not_conditions":[]}',
 TRUE,FALSE,'manual',156,2),

(4,'Donatur Aktif Belum Di-assign',
 'aktif tanpa assigned_to',
 '{"operator":"AND",
   "conditions":[
     {"type":"assigned_to_id","op":"is_null"},
     {"type":"status_kontak","value":"aktif"}],
   "not_conditions":[]}',
 TRUE,TRUE,'daily',4821,2),

(5,'Follow-up Overdue',
 'in_progress/waiting_callback dengan due date lewat',
 '{"operator":"AND",
   "conditions":[
     {"type":"follow_up_status","op":"in","value":["in_progress","waiting_callback"]},
     {"type":"follow_up_due_date","op":"<","value":"today"}],
   "not_conditions":[]}',
 FALSE,TRUE,'daily',23,2);

-- ============================================================
-- DONOR DYNAMIC FIELDS
-- ============================================================
INSERT INTO donor_dynamic_fields
    (donor_id, field_def_id, value_text, value_json, value_boolean, updated_by)
VALUES
-- wilayah_donatur
(1,1,'jabodetabek',NULL,NULL,1),(2,1,'jabodetabek',NULL,NULL,1),
(3,1,'jabodetabek',NULL,NULL,1),(4,1,'jawa_barat', NULL,NULL,1),
(5,1,'jawa_timur', NULL,NULL,1),(6,1,'jawa_tengah',NULL,NULL,1),
(10,1,'jabodetabek',NULL,NULL,1),(11,1,'sumatera', NULL,NULL,1),
(12,1,'jabodetabek',NULL,NULL,1),(23,1,'kalimantan',NULL,NULL,1),
-- preferensi_program
(1,2,NULL,'["ramadan","qurban","anak_yatim"]',NULL,1),
(2,2,NULL,'["ramadan","qurban","zakat_mal"]', NULL,1),
(3,2,NULL,'["wakaf","ramadan","qurban"]',     NULL,1),
(4,2,NULL,'["ramadan","qurban"]',             NULL,1),
(10,2,NULL,'["qurban","ramadan"]',            NULL,1),
(11,2,NULL,'["wakaf","qurban"]',              NULL,1),
-- profesi
(1,3,'pegawai_swasta',    NULL,NULL,1),(2,3,'wirausaha',       NULL,NULL,1),
(3,3,'wirausaha',         NULL,NULL,1),(6,3,'ibu_rumah_tangga',NULL,NULL,1),
(10,3,'profesional',      NULL,NULL,1),(11,3,'pegawai_negeri', NULL,NULL,1),
-- status_donatur_tetap
(1,4,NULL,NULL,TRUE,1),(2,4,NULL,NULL,TRUE,1),(3,4,NULL,NULL,TRUE,1),
(4,4,NULL,NULL,TRUE,1),(5,4,NULL,NULL,TRUE,1),(6,4,NULL,NULL,TRUE,1),
(10,4,NULL,NULL,FALSE,1),(11,4,NULL,NULL,FALSE,1),
-- channel_akuisisi
(1,5,'rekomendasi', NULL,NULL,1),(2,5,'media_sosial',NULL,NULL,1),
(3,5,'website',     NULL,NULL,1),(13,5,'website',    NULL,NULL,1),
(14,5,'media_sosial',NULL,NULL,1),(15,5,'whatsapp',  NULL,NULL,1);

-- ============================================================
-- EXTENSION CONFIGS
-- ============================================================
INSERT INTO extension_configs (ext_type, is_active, config_json, status) VALUES
('zains_sync',FALSE,
 '{"api_url":"https://zains-rn.internal/api/v1","api_key":"[disabled]",
   "sync_interval_minutes":60,"last_cursor":null,
   "note":"Menunggu pemisahan ZAINS ke server dedicated"}',
 'disabled'),
('cf_sync',FALSE,
 '{"api_url":"https://donol-rn.cnt.id/api/crm","api_key":"[disabled]",
   "note":"Menunggu pemisahan repo CF"}',
 'disabled'),
('whatsapp_extension',TRUE,
 '{"api_version":"1.0",
   "selectors":{
     "primary":"[data-testid=\"conversation-header\"] span[dir=\"auto\"]",
     "fallback":"._19vgK span:first-child",
     "phone_pattern":"^\\+?[0-9]{8,15}$"},
   "sidebar_position":"right","auto_expand":true,
   "show_last_notes":3,"enable_quick_action":true}',
 'active'),
('vendor_blast_api',FALSE,
 '{"note":"Out of scope. Aktifkan setelah MoU vendor."}',
 'disabled');

-- ============================================================
-- DATA IMPORTS LOG
-- ============================================================
INSERT INTO data_imports
    (entity_type, file_name, row_count_total, row_count_new,
     row_count_merge, row_count_skip, row_count_error, status, diupload_oleh)
VALUES
('donors',      'donatur_zains_jan2026.csv',   15420,1243,312,18,3,'done',4),
('transactions','transaksi_3thn_jan2026.csv',  48760,48760,0,12,0,'done',4),
('blast_report','wappin_ramadan2025_g1.csv',    9800,0,0,0,0,'done',4),
('blast_report','wappin_ramadan2025_g2.csv',    9500,0,0,0,0,'done',5),
('blast_report','mekari_qurban2025.csv',       12000,0,0,0,0,'done',5),
('donors',      'update_donatur_feb2026.csv',   2100,89,45,6,1,'done',4);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
INSERT INTO audit_logs
    (user_id, donor_id, action, entity_type, entity_id,
     field_changed, value_before, value_after, source, ip_address)
VALUES
(4,NULL,'import','data_import',1,NULL,NULL,
 '{"rows":15420,"new":1243,"merge":312}','upload_import','10.0.1.5'),
(1,20, 'update','donor',20,'status_kontak','"aktif"','"mati"',
 'upload_import','10.0.1.5'),
(1,21, 'update','donor',21,'status_kontak','"aktif"','"diblokir"',
 'upload_import','10.0.1.5'),
(2,NULL,'assign','donor',10,'assigned_to','null','6',
 'web_app','10.0.1.10'),
(6,1,  'create','prospect_note',3,NULL,NULL,
 '{"respon":"closing","campaign_id":15,"source":"chrome_extension"}',
 'chrome_extension','10.0.1.15'),
(9,10, 'create','prospect_note',8,NULL,NULL,
 '{"respon":"belum_merespon","channel":"web_whatsapp_ext"}',
 'chrome_extension','10.0.1.18'),
(1,NULL,'create','program',10,NULL,NULL,
 '{"slug":"muharram","nama":"Muharram"}','web_app','10.0.0.1'),
(1,NULL,'create','campaign',15,NULL,NULL,
 '{"slug":"qurban_2026","program_id":2}','web_app','10.0.0.1');

-- ============================================================
-- FINALIZE: Reset sequences + rebuild index + kalkulasi RFM
-- ============================================================
SELECT setval('users_id_seq',               (SELECT MAX(id) FROM users));
SELECT setval('programs_id_seq',            (SELECT MAX(id) FROM programs));
SELECT setval('campaigns_id_seq',           (SELECT MAX(id) FROM campaigns));
SELECT setval('donors_id_seq',              (SELECT MAX(id) FROM donors));
SELECT setval('transactions_id_seq',        (SELECT MAX(id) FROM transactions));
SELECT setval('field_definitions_id_seq',   (SELECT MAX(id) FROM field_definitions));
SELECT setval('vendor_profiles_id_seq',     (SELECT MAX(id) FROM vendor_profiles));
SELECT setval('blast_batches_id_seq',       (SELECT MAX(id) FROM blast_batches));
SELECT setval('blast_records_id_seq',       (SELECT MAX(id) FROM blast_records));
SELECT setval('prospect_notes_id_seq',      (SELECT MAX(id) FROM prospect_notes));
SELECT setval('saved_segments_id_seq',      (SELECT MAX(id) FROM saved_segments));
SELECT setval('donor_dynamic_fields_id_seq',(SELECT MAX(id) FROM donor_dynamic_fields));

DO $$
DECLARE
    v_id  BIGINT;
    v_rfm INTEGER;
BEGIN
    FOR v_id IN SELECT id FROM donors WHERE deleted_at IS NULL LOOP
        PERFORM fn_rebuild_search_index(v_id);
    END LOOP;
    SELECT fn_recalculate_rfm() INTO v_rfm;
    RAISE NOTICE 'Search index rebuilt. RFM recalculated for % donors.', v_rfm;
END;
$$;
```


---

## 7. Contoh Query

```sql
-- Q1. Qurban 2024 tapi belum Qurban 2025
--     program_participation key = programs.slug ("qurban")
SELECT d.id, d.nama_lengkap, d.no_hp_canonical, d.segmen_rfm
FROM donor_search_index dsi
JOIN donors d ON d.id = dsi.donor_id
WHERE dsi.search_doc @> '{"status":"aktif"}'
  AND dsi.search_doc->'program_participation'->'qurban' ? '2024-Q2'
  AND NOT (dsi.search_doc->'program_participation'->'qurban' ? '2025-Q2')
ORDER BY d.total_donation_lifetime DESC;

-- Q2. Ramadan 2025 tapi tidak donasi sesudah April 2025
SELECT d.id, d.nama_lengkap, d.last_donation_at
FROM donor_search_index dsi
JOIN donors d ON d.id = dsi.donor_id
WHERE dsi.search_doc @> '{"status":"aktif"}'
  AND dsi.search_doc->'program_participation'->'ramadan' ? '2025-Q1'
  AND (
      dsi.search_doc->>'last_donation_date' = ''
      OR (dsi.search_doc->>'last_donation_date')::DATE < '2025-05-01'
  );

-- Q3. Donatur yang pernah Qurban DAN Wakaf di tahun yang sama
SELECT d.id, d.nama_lengkap, d.total_donation_lifetime
FROM donor_search_index dsi
JOIN donors d ON d.id = dsi.donor_id
WHERE dsi.search_doc->'program_participation'->'qurban' ?| ARRAY['2024-Q2','2023-Q2']
  AND dsi.search_doc->'program_participation'->'wakaf'  ?| ARRAY['2024-Q3','2024-Q4','2023-Q1']
  AND (dsi.search_doc->>'status') = 'aktif';

-- Q4. Cek apakah donor tertentu pernah donasi program Ramadan
--     Pakai tabel transactions langsung (lookup spesifik, bukan bulk filter)
SELECT t.id, t.tgl_transaksi, t.nominal, t.bulan_program,
       c.nama AS campaign_nama
FROM transactions t
JOIN campaigns c ON c.id = t.campaign_id
WHERE t.donor_id = 1
  AND t.program_id = 1   -- program_id=1 = ramadan
  AND t.status = 'paid'
ORDER BY t.tgl_transaksi DESC;

-- Q5. Semua donatur yang berkontribusi ke campaign Qurban 2024
SELECT d.id, d.nama_lengkap, t.nominal, t.tgl_transaksi
FROM transactions t
JOIN donors d ON d.id = t.donor_id
WHERE t.campaign_id = 4   -- campaign_id=4 = qurban_2024
  AND t.status = 'paid'
ORDER BY t.nominal DESC;

-- Q6. Dashboard program: total donasi per program tahun 2024
SELECT p.slug, p.nama, COUNT(t.id) AS jumlah_transaksi,
       SUM(t.nominal) AS total_nominal,
       COUNT(DISTINCT t.donor_id) AS jumlah_donatur_unik
FROM transactions t
JOIN programs p ON p.id = t.program_id
WHERE t.bulan_program BETWEEN '2024-01' AND '2024-12'
  AND t.status = 'paid'
GROUP BY p.id, p.slug, p.nama
ORDER BY total_nominal DESC;

-- Q7. Lookup No. HP dari Chrome Extension (< 1ms)
SELECT d.id, d.nama_lengkap, d.status_kontak, d.segmen_rfm,
       d.skor_r, d.skor_f, d.skor_m,
       d.last_donation_at, d.last_donation_nominal,
       p.slug AS last_donation_program_slug,
       p.nama AS last_donation_program_nama,
       d.total_donation_lifetime, d.follow_up_status
FROM donors d
LEFT JOIN programs p ON p.id = d.last_donation_program_id
WHERE d.no_hp_canonical = '6281234567890'
  AND d.deleted_at IS NULL;

-- Q8. Worklist PIC id=6
SELECT * FROM v_donor_worklist
WHERE assigned_to = 6
ORDER BY priority_score DESC, follow_up_due_date ASC NULLS LAST
LIMIT 50;

-- Q9. Full-text search nama
SELECT d.id, d.nama_lengkap, d.no_hp_canonical
FROM donor_search_index dsi
JOIN donors d ON d.id = dsi.donor_id
WHERE dsi.search_vector @@ plainto_tsquery('indonesian', unaccent('budi santoso'));

-- Q10. At risk + wilayah jabodetabek (dynamic field + segmen)
SELECT d.id, d.nama_lengkap, d.skor_r, d.skor_f, d.skor_m
FROM donor_search_index dsi
JOIN donors d ON d.id = dsi.donor_id
WHERE (dsi.search_doc->>'segmen') = 'at_risk'
  AND dsi.search_doc->'dynamic' @> '{"wilayah_donatur":"jabodetabek"}';

-- Q11. Statistik campaign — conversion rate per blast batch
SELECT
    c.slug  AS campaign_slug,
    c.nama  AS campaign_nama,
    p.slug  AS program_slug,
    bb.tgl_blast,
    bb.jumlah_target,
    bb.jumlah_terkirim,
    bb.jumlah_closing,
    ROUND(100.0 * bb.jumlah_closing / NULLIF(bb.jumlah_terkirim,0), 2) AS closing_rate_pct,
    SUM(t.nominal) AS revenue_dari_campaign
FROM blast_batches bb
JOIN campaigns c ON c.id = bb.campaign_id
LEFT JOIN programs p ON p.id = c.program_id
LEFT JOIN transactions t ON t.campaign_id = c.id AND t.status = 'paid'
    AND t.tgl_transaksi BETWEEN bb.tgl_blast AND bb.tgl_blast + interval '30 days'
WHERE bb.import_status = 'done'
GROUP BY c.id, c.slug, c.nama, p.slug, bb.id, bb.tgl_blast,
         bb.jumlah_target, bb.jumlah_terkirim, bb.jumlah_closing
ORDER BY bb.tgl_blast DESC;

-- Q12. Rebuild index satu donor
SELECT fn_rebuild_search_index(1);

-- Q13. Kalkulasi RFM ulang
SELECT fn_recalculate_rfm();
```

---

## 8. Catatan Desain

### Kenapa programs & campaigns dipisah jadi tabel?

| Masalah jika VARCHAR bebas | Solusi dengan tabel master |
|---|---|
| "Ramadhan" vs "Ramadan" jadi 2 program berbeda | Slug immutable — satu program satu ID |
| Tidak bisa query "semua transaksi program X" dengan aman | `WHERE program_id = 1` — selalu benar |
| Tidak ada metadata (kategori, periode, deskripsi) | Kolom lengkap di `programs` |
| `program_participation` di search index inkonsisten | Key = `slug` yang immutable |
| Tidak bisa analitik per program di dashboard | JOIN `programs` langsung |
| Campaign tidak punya konteks program | `campaigns.program_id` FK ke `programs` |

### Alur Data Program ke Search Index

```
Transaction baru (program_id=1, tgl=2025-03-15)
    ↓ trigger fn_set_bulan_program → bulan_program = '2025-03'
    ↓ trigger fn_update_donor_stats → donors.last_donation_program_id = 1
    ↓ background job fn_rebuild_search_index(donor_id)
        → JOIN programs WHERE id=1 → slug='ramadan'
        → search_doc.program_participation['ramadan'] += '2025-Q1'
        → search_doc.last_donation_program_slug = 'ramadan'

Query filter:
    dsi.search_doc->'program_participation'->'ramadan' ? '2025-Q1'
    → GIN index idx_dsi_participation → sub-50ms untuk 500k donor
```

### Strategi Import Data Historis

Saat import data lama dari ZAINS (transaksi tanpa `campaign_id`):
1. Buat campaign generik per tahun per program: `ramadan_2022`, `qurban_2022`, dll.
2. Import transaksi dengan `campaign_id` pointing ke campaign generik
3. Atau set `campaign_id = NULL` — opsional, tetap valid
