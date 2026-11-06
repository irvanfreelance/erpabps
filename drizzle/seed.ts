import { config } from "dotenv";
import { hash } from "bcryptjs";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

type Row = Record<string, unknown>;
type Sql = {
  query: (query: string, params?: unknown[]) => Promise<Row[]>;
};

function rowsOf(res: unknown): Row[] {
  return res as Row[];
}

async function seedBaseline(sql: Sql) {
  const orgName = process.env.ORG_NAME ?? "CRM Relawan Nusantara";
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@rn.org";
  const adminName = process.env.ADMIN_NAME ?? "Admin Sistem";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMeNow!";
  const passwordHash = await hash(adminPassword, 12);

  const configs: [string, string, string][] = [
    ["app_name", orgName, "Nama aplikasi"],
    ["timezone", "Asia/Jakarta", "Timezone default"],
    ["blast_cooldown_days", "14", "Jeda minimum blast ke donatur yang sama"],
    ["rfm_window_months", "12", "Window kalkulasi RFM dalam bulan"],
    ["max_dynamic_fields", "50", "Maks field dinamis"],
    ["version", "2.0.0", "Versi skema DB"],
  ];

  const tagCatalog: [string, string, string][] = [
    ["prioritas", "Prioritas", "#c0392b"],
    ["loyal", "Loyal", "#01665a"],
    ["qurban_rutin", "Qurban rutin", "#8e44ad"],
    ["high_value", "High value", "#d35400"],
    ["wakaf", "Wakaf", "#1e8449"],
    ["ramadan_rutin", "Ramadan rutin", "#1a5276"],
    ["ibu_rt", "Ibu RT", "#b9770e"],
    ["perlu_reengagement", "Perlu re-engagement", "#e74c3c"],
    ["champion_lama", "Champion lama", "#7d3c98"],
    ["new_donor", "Donatur baru", "#3498db"],
    ["merged_3_ids", "Merged 3 IDs", "#7f8c8d"],
    ["overdue_followup", "Follow-up overdue", "#922b21"],
  ];
  for (const [slug, nama, warna] of tagCatalog) {
    await sql.query(
      `INSERT INTO tag_definitions (slug, nama, warna, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (slug) DO UPDATE SET nama = EXCLUDED.nama, warna = EXCLUDED.warna`,
      [slug, nama, warna],
    );
  }

  for (const [key, value, description] of configs) {
    await sql.query(
      `INSERT INTO app_config (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET
         value = CASE WHEN app_config.key = 'version' THEN EXCLUDED.value ELSE app_config.value END,
         description = COALESCE(app_config.description, EXCLUDED.description),
         updated_at = CASE WHEN app_config.key = 'version' THEN now() ELSE app_config.updated_at END`,
      [key, value, description],
    );
  }

  await sql.query(
    `INSERT INTO users (nama, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE SET
       nama = EXCLUDED.nama,
       role = 'admin',
       is_active = TRUE,
       deleted_at = NULL,
       password_hash = EXCLUDED.password_hash,
       updated_at = now()`,
    [adminName, adminEmail, passwordHash],
  );

  const extTypes = [
    ["zains_sync", false, "idle"],
    ["cf_sync", false, "idle"],
    ["whatsapp_extension", true, "idle"],
    ["vendor_blast_api", false, "idle"],
  ] as const;
  for (const [extType, isActive, status] of extTypes) {
    await sql.query(
      `INSERT INTO extension_configs (ext_type, is_active, status, config_json)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ext_type) DO NOTHING`,
      [
        extType,
        isActive,
        status,
        JSON.stringify(
          extType === "whatsapp_extension"
            ? {
                selectors: [
                  { name: "headerPhone", css: "header span[title]", fallback: true },
                ],
              }
            : {},
        ),
      ],
    );
  }

  const orgNama = process.env.ORG_NAME ?? "Relawan Nusantara";
  const orgShort = process.env.ORG_SHORT_NAME ?? "RN";
  const orgTagline = process.env.ORG_TAGLINE ?? "CRM Superadmin";
  const orgLogo =
    process.env.ORG_LOGO_URL ??
    "https://erp.relawannusantara.org/web/image/cnt_cf.res_company/18/logo_perusahaan_putih/18.png?w=100&h=42&q=100&upscale=true&auto=compress,format";
  const orgPrimary = process.env.ORG_PRIMARY_COLOR ?? "#01665a";
  const orgSidebar = process.env.ORG_SIDEBAR_COLOR ?? "#01665a";
  const orgAccent = process.env.ORG_ACCENT_COLOR ?? "#2e8b7a";
  const orgFavicon = process.env.ORG_FAVICON_URL ?? orgLogo;

  await sql.query(
    `INSERT INTO org_profile (
       id, nama, nama_singkat, tagline, logo_url, favicon_url,
       primary_color, sidebar_color, accent_color, is_seed_default
     ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     ON CONFLICT (id) DO UPDATE SET
       nama = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.nama ELSE org_profile.nama END,
       nama_singkat = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.nama_singkat ELSE org_profile.nama_singkat END,
       tagline = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.tagline ELSE org_profile.tagline END,
       logo_url = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.logo_url ELSE org_profile.logo_url END,
       favicon_url = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.favicon_url ELSE org_profile.favicon_url END,
       primary_color = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.primary_color ELSE org_profile.primary_color END,
       sidebar_color = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.sidebar_color ELSE org_profile.sidebar_color END,
       accent_color = CASE WHEN org_profile.is_seed_default THEN EXCLUDED.accent_color ELSE org_profile.accent_color END,
       updated_at = CASE WHEN org_profile.is_seed_default THEN now() ELSE org_profile.updated_at END`,
    [orgNama, orgShort, orgTagline, orgLogo, orgFavicon, orgPrimary, orgSidebar, orgAccent],
  );

  console.log("Baseline seed OK:", adminEmail, orgNama);
}

async function seedSample(sql: Sql) {
  const demoHash = await hash("password123", 12);
  const sampleUsers = [
    ["Regi Fajar R.", "regi@cnt.id", "supervisor"],
    ["Dev", "dev@cnt.id", "supervisor"],
    ["Sari Rahmawati", "sari@rn.org", "data_analyst"],
    ["Dian Kusuma", "dian@rn.org", "data_analyst"],
    ["Budi Santoso", "budi@rn.org", "tim_blast"],
    ["Rina Dewi", "rina@rn.org", "tim_blast"],
    ["Ahmad Fauzi", "ahmad@rn.org", "tim_blast"],
    ["Lestari Wulandari", "lestari@rn.org", "tim_blast"],
    ["Hendra Gunawan", "hendra@rn.org", "tim_blast"],
    ["Fitriani Noor", "fitri@rn.org", "tim_blast"],
    ["Viewer Only", "viewer@rn.org", "read_only"],
  ] as const;
  for (const [nama, email, role] of sampleUsers) {
    await sql.query(
      `INSERT INTO users (nama, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [nama, email, demoHash, role],
    );
  }

  const adminRows = rowsOf(
    await sql.query(`SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY id LIMIT 1`),
  );
  const adminId = String(adminRows[0].id);
  const userId = async (email: string) =>
    String(rowsOf(await sql.query(`SELECT id FROM users WHERE email = $1`, [email]))[0].id);

  const programs = [
    ["ramadan", "Ramadan", "seasonal", 1],
    ["qurban", "Qurban", "seasonal", 2],
    ["zakat_fitrah", "Zakat Fitrah", "zakat", 3],
    ["zakat_mal", "Zakat Mal", "zakat", 4],
    ["wakaf", "Wakaf", "wakaf", 5],
    ["anak_yatim", "Anak Yatim", "reguler", 6],
    ["bencana_alam", "Bencana Alam", "emergency", 7],
    ["beasiswa", "Beasiswa", "reguler", 8],
    ["infaq", "Infaq & Sedekah", "reguler", 9],
    ["muharram", "Muharram", "seasonal", 10],
  ] as const;
  for (const [slug, nama, kategori, sort] of programs) {
    await sql.query(
      `INSERT INTO programs (slug, nama, deskripsi, kategori, is_active, sort_order, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)
       ON CONFLICT (slug) DO NOTHING`,
      [slug, nama, `Program ${nama}`, kategori, sort, adminId],
    );
  }
  const programId = async (slug: string) =>
    String(rowsOf(await sql.query(`SELECT id FROM programs WHERE slug = $1`, [slug]))[0].id);

  const campaigns: [string, string, string | null, string, string | null, string | null][] = [
    ["ramadan_2023", "Ramadan 2023", "ramadan", "seasonal", "2023-03-01", "2023-04-30"],
    ["qurban_2023", "Qurban 2023", "qurban", "seasonal", "2023-05-01", "2023-07-31"],
    ["ramadan_2024", "Ramadan 2024", "ramadan", "seasonal", "2024-03-01", "2024-04-30"],
    ["qurban_2024", "Qurban 2024", "qurban", "seasonal", "2024-05-01", "2024-07-31"],
    ["zakat_fitrah_2024", "Zakat Fitrah 2024", "zakat_fitrah", "seasonal", "2024-03-15", "2024-04-09"],
    ["reengagement_q4_2025", "Re-engagement At Risk Q4", null, "reengagement", "2025-10-01", "2025-12-31"],
    ["ramadan_2025", "Ramadan 2025", "ramadan", "seasonal", "2025-02-28", "2025-04-30"],
    ["qurban_2025_early", "Qurban 2025 Early Bird", "qurban", "seasonal", "2025-04-01", "2025-06-30"],
    ["onboarding_new", "Onboarding Donatur Baru", null, "onboarding", null, null],
    ["qurban_2026", "Qurban 2026", "qurban", "seasonal", "2026-04-01", "2026-07-31"],
    ["bencana_alam_2026", "Darurat Bencana 2026", "bencana_alam", "blast", "2026-01-01", null],
  ];
  for (const [slug, nama, pslug, tipe, mulai, selesai] of campaigns) {
    const pid = pslug ? await programId(pslug) : null;
    await sql.query(
      `INSERT INTO campaigns (slug, nama, deskripsi, program_id, tipe, tgl_mulai, tgl_selesai, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
       ON CONFLICT (slug) DO NOTHING`,
      [slug, nama, nama, pid, tipe, mulai, selesai, adminId],
    );
  }
  const campaignId = async (slug: string) =>
    String(rowsOf(await sql.query(`SELECT id FROM campaigns WHERE slug = $1`, [slug]))[0].id);

  const fields = [
    ["wilayah_donatur", "Wilayah", "dropdown", ["Jabodetabek", "Jawa Barat", "Jawa Tengah", "Jawa Timur", "Sumatera", "Lainnya"]],
    ["preferensi_program", "Preferensi Program", "multiselect", ["ramadan", "qurban", "wakaf"]],
    ["profesi", "Profesi", "dropdown", ["ASN", "Swasta", "Wirausaha", "Ibu Rumah Tangga", "Lainnya"]],
    ["donatur_tetap", "Donatur Tetap", "boolean", []],
    ["channel_akuisisi", "Channel Akuisisi", "dropdown", ["WA Blast", "Website", "Event", "Referral"]],
  ] as const;
  for (const [slug, label, tipe, options] of fields) {
    await sql.query(
      `INSERT INTO field_definitions (slug, label, tipe, options_json, is_searchable, is_active, created_by)
       VALUES ($1, $2, $3, $4::jsonb, TRUE, TRUE, $5)
       ON CONFLICT (slug) DO NOTHING`,
      [slug, label, tipe, JSON.stringify(options), adminId],
    );
  }

  const vendors = [
    [
      "Wappin v2",
      { no_hp: "Phone Number", status: "Delivery Status", dibaca: "Read", respon: "Response" },
      { Delivered: "terkirim", Read: "terkirim", Failed: "nomor_mati", Blocked: "diblokir" },
      true,
    ],
    [
      "Mekari Qontak",
      { no_hp: "destination", status: "message_status", dibaca: "is_read" },
      { sent: "terkirim", delivered: "terkirim", failed: "nomor_mati" },
      false,
    ],
    [
      "Cekat AI",
      { no_hp: "whatsapp_number", status: "send_status" },
      { SUCCESS: "terkirim", FAILED: "nomor_mati" },
      false,
    ],
  ] as const;
  for (const [nama, cmap, smap, isDefault] of vendors) {
    await sql.query(
      `INSERT INTO vendor_profiles (nama_vendor, column_mapping, status_mapping, is_default, created_by)
       SELECT $1::varchar, $2::jsonb, $3::jsonb, $4, $5::bigint
       WHERE NOT EXISTS (SELECT 1 FROM vendor_profiles WHERE nama_vendor = $1::varchar)`,
      [nama, JSON.stringify(cmap), JSON.stringify(smap), isDefault, adminId],
    );
  }

  const budi = await userId("budi@rn.org");
  const rina = await userId("rina@rn.org");
  const ahmad = await userId("ahmad@rn.org");
  const lestari = await userId("lestari@rn.org");
  const hendra = await userId("hendra@rn.org");
  const fitri = await userId("fitri@rn.org");
  const sari = await userId("sari@rn.org");
  const regi = await userId("regi@cnt.id");

  const donors: Array<{
    hp: string;
    nama: string;
    email: string | null;
    status: string;
    segmen: string | null;
    r: number | null;
    f: number | null;
    m: number | null;
    tags: string[];
    pic: string | null;
    fu: string | null;
    due: string | null;
  }> = [
    { hp: "6281234567890", nama: "Budi Rahmat Santoso", email: "budi.rahmat@email.com", status: "aktif", segmen: "champions", r: 5, f: 5, m: 5, tags: ["prioritas", "loyal"], pic: budi, fu: "in_progress", due: "2026-04-20" },
    { hp: "6285678901234", nama: "Dewi Anggraeni Putri", email: "dewi.anggraeni@gmail.com", status: "aktif", segmen: "champions", r: 5, f: 5, m: 5, tags: ["prioritas", "qurban_rutin"], pic: rina, fu: "waiting_callback", due: "2026-04-18" },
    { hp: "6287890123456", nama: "Hendra Wijaksono", email: "hendra.w@company.co.id", status: "aktif", segmen: "champions", r: 4, f: 5, m: 5, tags: ["high_value", "wakaf"], pic: ahmad, fu: null, due: null },
    { hp: "6282345678901", nama: "Siti Nurhaliza Rahmah", email: "siti.nurhaliza@yahoo.com", status: "aktif", segmen: "loyal", r: 4, f: 4, m: 4, tags: ["loyal", "ramadan_rutin"], pic: budi, fu: "in_progress", due: "2026-04-25" },
    { hp: "6289012345678", nama: "Rizal Fahmi Harahap", email: "rizal.fahmi@gmail.com", status: "aktif", segmen: "loyal", r: 4, f: 4, m: 3, tags: ["loyal"], pic: rina, fu: null, due: null },
    { hp: "6281122334455", nama: "Fatimah Zahra Nasution", email: "fatimah@email.com", status: "aktif", segmen: "loyal", r: 5, f: 4, m: 3, tags: ["loyal", "ibu_rt"], pic: ahmad, fu: null, due: null },
    { hp: "6285544332211", nama: "Agus Setiawan Prabowo", email: "agus@email.com", status: "aktif", segmen: "potential", r: 4, f: 3, m: 3, tags: [], pic: lestari, fu: null, due: null },
    { hp: "6288776655443", nama: "Nurul Hidayah Wahab", email: "nurul@gmail.com", status: "aktif", segmen: "potential", r: 3, f: 3, m: 2, tags: [], pic: hendra, fu: null, due: null },
    { hp: "6283321098765", nama: "Teguh Santoso Haryono", email: "teguh@email.com", status: "aktif", segmen: "potential", r: 3, f: 2, m: 3, tags: [], pic: fitri, fu: null, due: null },
    { hp: "6286655443322", nama: "Indah Permatasari", email: "indah@gmail.com", status: "aktif", segmen: "at_risk", r: 2, f: 4, m: 4, tags: ["perlu_reengagement"], pic: budi, fu: "in_progress", due: "2026-04-15" },
    { hp: "6289988776655", nama: "Bambang Eko Prasetyo", email: "bambang@yahoo.com", status: "aktif", segmen: "at_risk", r: 2, f: 3, m: 4, tags: ["perlu_reengagement", "high_value"], pic: rina, fu: "waiting_callback", due: "2026-04-17" },
    { hp: "6281098765432", nama: "Yanti Sulistyowati", email: "yanti@email.com", status: "aktif", segmen: "at_risk", r: 1, f: 5, m: 5, tags: ["perlu_reengagement", "champion_lama"], pic: ahmad, fu: "in_progress", due: "2026-04-12" },
    { hp: "6282211009988", nama: "Andi Firmansyah", email: "andi@email.com", status: "aktif", segmen: "new", r: 5, f: 1, m: 2, tags: ["new_donor"], pic: lestari, fu: null, due: null },
    { hp: "6285533221100", nama: "Lia Septiani K.", email: "lia@gmail.com", status: "aktif", segmen: "new", r: 5, f: 1, m: 1, tags: ["new_donor"], pic: hendra, fu: null, due: null },
    { hp: "6287766554433", nama: "Rendra Pratama", email: "rendra@email.com", status: "aktif", segmen: "new", r: 5, f: 1, m: 2, tags: ["new_donor"], pic: fitri, fu: null, due: null },
    { hp: "6283344556677", nama: "Desi Ratnasari", email: "desi@yahoo.com", status: "aktif", segmen: "one_time", r: 3, f: 1, m: 2, tags: [], pic: budi, fu: null, due: null },
    { hp: "6286677889900", nama: "Fajar Nugroho W.", email: "fajar@email.com", status: "aktif", segmen: "one_time", r: 2, f: 1, m: 1, tags: [], pic: rina, fu: null, due: null },
    { hp: "6281234500000", nama: "Gunawan Saputra", email: "gunawan@email.com", status: "aktif", segmen: "lost", r: 1, f: 1, m: 1, tags: [], pic: null, fu: null, due: null },
    { hp: "6285599887766", nama: "Wulandari Prasetyo", email: null, status: "aktif", segmen: "lost", r: 1, f: 2, m: 1, tags: [], pic: null, fu: null, due: null },
    { hp: "6287788990011", nama: "Riko Maulana", email: "riko@gmail.com", status: "mati", segmen: null, r: null, f: null, m: null, tags: [], pic: null, fu: null, due: null },
    { hp: "6281199887766", nama: "Sri Lestari", email: "sri@email.com", status: "diblokir", segmen: null, r: null, f: null, m: null, tags: [], pic: null, fu: null, due: null },
    { hp: "6289900112233", nama: "Pak Hartono", email: "hartono@email.com", status: "opt_out", segmen: null, r: null, f: null, m: null, tags: [], pic: null, fu: null, due: null },
    { hp: "6284455667788", nama: "Kurniawan Effendi", email: "kurniawan@email.com", status: "aktif", segmen: "loyal", r: 4, f: 4, m: 4, tags: ["merged_3_ids"], pic: ahmad, fu: null, due: null },
    { hp: "6281357924680", nama: "Maya Sari Dewi", email: "maya@email.com", status: "aktif", segmen: "at_risk", r: 2, f: 3, m: 3, tags: ["overdue_followup"], pic: lestari, fu: "in_progress", due: "2026-03-01" },
    { hp: "6289753186420", nama: "Doni Hermawan", email: "doni@gmail.com", status: "aktif", segmen: "potential", r: 3, f: 2, m: 2, tags: [], pic: null, fu: null, due: null },
  ];

  for (const d of donors) {
    await sql.query(
      `INSERT INTO donors (
         no_hp_canonical, nama_lengkap, email, tgl_registrasi, sumber_registrasi,
         status_kontak, segmen_rfm, skor_r, skor_f, skor_m, tags, assigned_to,
         follow_up_status, follow_up_due_date, assigned_at
       ) VALUES (
         $1::varchar, $2::varchar, $3::varchar, '2023-01-15', 'upload',
         $4::varchar, $5::varchar, $6::smallint, $7::smallint, $8::smallint, $9::text[], $10::bigint,
         $11::varchar, $12::date, CASE WHEN $10::bigint IS NULL THEN NULL ELSE now() END
       )
       ON CONFLICT (no_hp_canonical) DO NOTHING`,
      [
        d.hp,
        d.nama,
        d.email,
        d.status,
        d.segmen,
        d.r,
        d.f,
        d.m,
        `{${d.tags.join(",")}}`,
        d.pic,
        d.fu,
        d.due,
      ],
    );
  }
  const donorId = async (hp: string) =>
    String(rowsOf(await sql.query(`SELECT id FROM donors WHERE no_hp_canonical = $1`, [hp]))[0].id);

  const trx: [string, string, string | null, string, number, string, string][] = [
    ["6281234567890", "ramadan", "ramadan_2023", "2023-03-25", 300000, "paid", "SEED-TRX-001"],
    ["6281234567890", "ramadan", "ramadan_2024", "2024-03-18", 400000, "paid", "SEED-TRX-002"],
    ["6281234567890", "ramadan", "ramadan_2025", "2025-03-15", 500000, "paid", "SEED-TRX-003"],
    ["6281234567890", "qurban", "qurban_2024", "2024-06-10", 750000, "paid", "SEED-TRX-004"],
    ["6285678901234", "ramadan", "ramadan_2025", "2025-03-10", 1000000, "paid", "SEED-TRX-005"],
    ["6285678901234", "qurban", "qurban_2024", "2024-06-01", 2000000, "paid", "SEED-TRX-006"],
    ["6287890123456", "wakaf", null, "2025-06-01", 2000000, "paid", "SEED-TRX-007"],
    ["6282345678901", "ramadan", "ramadan_2025", "2025-03-20", 300000, "paid", "SEED-TRX-008"],
    ["6286655443322", "qurban", "qurban_2024", "2024-10-20", 500000, "paid", "SEED-TRX-009"],
    ["6281098765432", "qurban", "qurban_2024", "2024-06-20", 1000000, "paid", "SEED-TRX-010"],
    ["6285544332211", "qurban", "qurban_2026", "2026-04-01", 300000, "checkout", "SEED-TRX-011"],
    ["6282211009988", "ramadan", null, "2026-04-10", 100000, "paid", "SEED-TRX-012"],
    ["6281357924680", "anak_yatim", "ramadan_2024", "2024-12-10", 250000, "paid", "SEED-TRX-013"],
    ["6284455667788", "ramadan", "ramadan_2025", "2025-05-20", 400000, "paid", "SEED-TRX-014"],
    ["6289988776655", "wakaf", null, "2024-09-15", 750000, "paid", "SEED-TRX-015"],
  ];
  for (const [hp, pslug, cslug, tgl, nom, status, ref] of trx) {
    const did = await donorId(hp);
    const pid = await programId(pslug);
    const cid = cslug ? await campaignId(cslug) : null;
    await sql.query(
      `INSERT INTO transactions (donor_id, program_id, campaign_id, id_transaksi_zains, tgl_transaksi, bulan_program, nominal, status, sumber)
       SELECT $1::bigint, $2::bigint, $3::bigint, $4::varchar, $5::date, to_char($5::date, 'YYYY-MM'), $6::bigint, $7::varchar, 'upload'
       WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE id_transaksi_zains = $4::varchar)`,
      [did, pid, cid, ref, tgl, nom, status],
    );
  }

  const wilayahId = String(
    rowsOf(await sql.query(`SELECT id FROM field_definitions WHERE slug = 'wilayah_donatur'`))[0].id,
  );
  const tetapId = String(
    rowsOf(await sql.query(`SELECT id FROM field_definitions WHERE slug = 'donatur_tetap'`))[0].id,
  );
  const d1 = await donorId("6281234567890");
  await sql.query(
    `INSERT INTO donor_dynamic_fields (donor_id, field_def_id, value_text, updated_by)
     SELECT $1, $2, 'Jabodetabek', $3
     WHERE NOT EXISTS (SELECT 1 FROM donor_dynamic_fields WHERE donor_id = $1 AND field_def_id = $2)`,
    [d1, wilayahId, adminId],
  );
  await sql.query(
    `INSERT INTO donor_dynamic_fields (donor_id, field_def_id, value_boolean, updated_by)
     SELECT $1, $2, TRUE, $3
     WHERE NOT EXISTS (SELECT 1 FROM donor_dynamic_fields WHERE donor_id = $1 AND field_def_id = $2)`,
    [d1, tetapId, adminId],
  );

  const wappinId = String(
    rowsOf(await sql.query(`SELECT id FROM vendor_profiles WHERE nama_vendor = 'Wappin v2'`))[0].id,
  );
  const ramadan2025 = await campaignId("ramadan_2025");
  const existingBatch = rowsOf(
    await sql.query(`SELECT id FROM blast_batches WHERE campaign_id = $1 AND tgl_blast = '2025-03-01'`, [ramadan2025]),
  );
  let batchId: string;
  if (existingBatch.length) {
    batchId = String(existingBatch[0].id);
  } else {
    const inserted = rowsOf(
      await sql.query(
        `INSERT INTO blast_batches (
         campaign_id, vendor_profile_id, tgl_blast, jumlah_target, jumlah_terkirim,
         jumlah_gagal, jumlah_dibaca, jumlah_respon, jumlah_closing, import_status, diimport_oleh
       ) VALUES ($1, $2, '2025-03-01', 25, 22, 3, 10, 5, 2, 'done', $3)
       RETURNING id`,
        [ramadan2025, wappinId, sari],
      ),
    );
    batchId = String(inserted[0].id);
  }
  await sql.query(
    `INSERT INTO blast_records (donor_id, blast_batch_id, tgl_kirim, status_kirim, dibaca, respon)
     SELECT $1, $2, '2025-03-01 09:00+07', 'terkirim', TRUE, 'closing'
     WHERE NOT EXISTS (SELECT 1 FROM blast_records WHERE donor_id = $1 AND blast_batch_id = $2)`,
    [d1, batchId],
  );

  const ramadanC = ramadan2025;
  await sql.query(
    `INSERT INTO prospect_notes (donor_id, user_id, campaign_id, tgl_prospek, channel, respon_donatur, catatan_bebas, source)
     SELECT $1, $2, $3, '2025-03-02', 'wappin', 'closing', 'Transfer langsung.', 'web_app'
     WHERE NOT EXISTS (
       SELECT 1 FROM prospect_notes WHERE donor_id = $1 AND user_id = $2 AND tgl_prospek = '2025-03-02'
     )`,
    [d1, budi, ramadanC],
  );

  await sql.query(
    `INSERT INTO saved_segments (nama, deskripsi, query_json, is_public, refresh_schedule, last_count, dibuat_oleh)
     SELECT 'At Risk High Value', 'Segmen sampel', '{"conditions":[{"field":"segmen","op":"eq","value":"at_risk"}]}'::jsonb, TRUE, 'manual', 4, $1
     WHERE NOT EXISTS (SELECT 1 FROM saved_segments WHERE nama = 'At Risk High Value')`,
    [regi],
  );
  const segId = String(
    rowsOf(await sql.query(`SELECT id FROM saved_segments WHERE nama = 'At Risk High Value'`))[0].id,
  );
  const atRiskHp = ["6286655443322", "6289988776655", "6281098765432", "6281357924680"];
  for (const hp of atRiskHp) {
    const did = await donorId(hp);
    await sql.query(
      `INSERT INTO saved_segment_results (segment_id, donor_id)
       SELECT $1, $2
       WHERE NOT EXISTS (SELECT 1 FROM saved_segment_results WHERE segment_id = $1 AND donor_id = $2)`,
      [segId, did],
    );
  }

  await sql.query(
    `INSERT INTO donor_assignment_history (donor_id, assigned_to, assigned_by, reason)
     SELECT $1, $2, $3, 'seed sample'
     WHERE NOT EXISTS (
       SELECT 1 FROM donor_assignment_history WHERE donor_id = $1 AND reason = 'seed sample'
     )`,
    [d1, budi, regi],
  );

  await sql.query(
    `INSERT INTO distribute_batches (segment_id, total_donors, pic_count, config_json, status, dijalankan_oleh, completed_at)
     SELECT $1, 4, 3, '{"max_per_pic":50}'::jsonb, 'done', $2, now()
     WHERE NOT EXISTS (SELECT 1 FROM distribute_batches WHERE segment_id = $1)`,
    [segId, regi],
  );

  await sql.query(
    `INSERT INTO data_imports (entity_type, file_name, row_count_total, row_count_new, row_count_merge, status, diupload_oleh, completed_at)
     SELECT 'donors', 'seed_donors.csv', 25, 25, 0, 'done', $1, now()
     WHERE NOT EXISTS (SELECT 1 FROM data_imports WHERE file_name = 'seed_donors.csv')`,
    [sari],
  );

  const donorRows = rowsOf(await sql.query(`SELECT id FROM donors WHERE deleted_at IS NULL`));
  for (const row of donorRows) {
    await sql.query(`SELECT fn_rebuild_search_index($1::bigint)`, [String(row.id)]);
  }
  await sql.query(`SELECT fn_recalculate_rfm()`);

  await sql.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, value_after, source)
     SELECT $1, 'import', 'seed', NULL, '{"sample":true}'::jsonb, 'upload_import'
     WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'import' AND entity_type = 'seed')`,
    [adminId],
  );

  console.log("Sample seed OK:", donorRows.length, "donors");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url) as unknown as Sql;
  await seedBaseline(sql);
  if (process.env.SEED_SAMPLE === "true") {
    await seedSample(sql);
  } else {
    console.log("SEED_SAMPLE is not true — skipped correlated sample data");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
