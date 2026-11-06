import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

type Row = Record<string, unknown>;
type Sql = {
  query: (query: string, params?: unknown[]) => Promise<Row[]>;
};

type RosterPerson = {
  source_row: number;
  full_name: string;
  employee_number: string | null;
  position_code: string | null;
  position_label: string | null;
  pay_group_code: string | null;
  location_code: string | null;
  location_label: string | null;
  join_date: string | null;
  compensation_text: string | null;
  block_reasons?: string[];
};

type SeedDoc = {
  org_profile: { nama: string; nama_singkat: string; tagline: string };
  locations: { code: string; name: string }[];
  ready_employees: RosterPerson[];
  blocked_employees: RosterPerson[];
};

function rowsOf(res: unknown): Row[] {
  return res as Row[];
}

async function openSql(url: string): Promise<Sql> {
  const neonHost = url.includes("neon.tech") || url.startsWith("https://");
  if (!neonHost) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url });
    return {
      query: async (text, params) => {
        const result = await pool.query(text, params);
        return result.rows as Row[];
      },
    };
  }
  return neon(url) as unknown as Sql;
}

async function seedBaseline(sql: Sql, org: SeedDoc["org_profile"]) {
  const orgName = process.env.ORG_NAME ?? org.nama;
  const orgShort = process.env.ORG_SHORT_NAME ?? org.nama_singkat;
  const orgTagline = process.env.ORG_TAGLINE ?? org.tagline;
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const nama = process.env.ADMIN_NAME?.trim() || "Superadmin";

  const configs: [string, string, string][] = [
    ["app_name", orgName, "Nama aplikasi"],
    ["timezone", "Asia/Jakarta", "Timezone default"],
    ["version", "3.0.0", "Versi skema ERP HRD"],
  ];
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

  const orgLogo = process.env.ORG_LOGO_URL ?? null;
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
    [orgName, orgShort, orgTagline, orgLogo, orgFavicon, orgPrimary, orgSidebar, orgAccent],
  );

  if (!email) {
    console.log(
      "Superadmin tidak dibuat. Set ADMIN_EMAIL, ADMIN_NAME, dan ADMIN_PASSWORD di environment, lalu jalankan npm run db:seed lagi. Jangan menulis password ke repo.",
    );
    return null;
  }
  if (!password) {
    const existing = rowsOf(await sql.query(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [email]));
    if (existing[0]) {
      console.log("ADMIN_PASSWORD kosong. Akun yang sudah ada tidak diubah.");
      return String(existing[0].id);
    }
    console.log(
      "Superadmin tidak dibuat karena ADMIN_PASSWORD kosong. Set ADMIN_EMAIL, ADMIN_NAME, dan ADMIN_PASSWORD, lalu jalankan npm run db:seed lagi.",
    );
    return null;
  }
  const passwordHash = await hash(password, 12);
  const rows = rowsOf(
    await sql.query(
      `INSERT INTO users (nama, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'superadmin', TRUE)
       ON CONFLICT (email) DO UPDATE SET
         nama = EXCLUDED.nama,
         role = 'superadmin',
         is_active = TRUE,
         deleted_at = NULL,
         password_hash = EXCLUDED.password_hash,
         updated_at = now()
       RETURNING id`,
      [nama, email, passwordHash],
    ),
  );
  console.log("Superadmin siap untuk", email);
  return String(rows[0].id);
}

async function seedCatalog(sql: Sql, doc: SeedDoc, actorId: string | null) {
  for (const loc of doc.locations) {
    await sql.query(
      `INSERT INTO locations (code, name) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
      [loc.code, loc.name],
    );
  }

  const departments = [
    ["DEPT_OUTLET", "Outlet"],
    ["DEPT_DAPUR", "Dapur Pusat"],
    ["DEPT_UMUM", "Umum"],
  ];
  for (const [code, name] of departments) {
    await sql.query(
      `INSERT INTO departments (code, name) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [code, name],
    );
  }

  const payGroups: [string, string, string, number | null, number | null, number | null][] = [
    ["WEEKLY_DAPUR", "Dapur mingguan", "weekly", 6, null, 5],
    ["MONTHLY_DAPUR_OFFICE", "Dapur office hour", "monthly", null, 1, null],
    ["MONTHLY_OUTLET", "Outlet bulanan", "monthly", null, 1, null],
    ["MONTHLY_KANTOR", "Kantor bulanan", "monthly", null, 1, null],
    ["PART_TIME", "Paruh waktu", "monthly", null, 1, null],
  ];
  for (const [code, name, freq, weekStart, paydayDay, paydayDow] of payGroups) {
    await sql.query(
      `INSERT INTO pay_groups (code, name, pay_frequency, week_start_dow, payday_day, payday_dow)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO NOTHING`,
      [code, name, freq, weekStart, paydayDay, paydayDow],
    );
  }

  const people = [...doc.ready_employees, ...doc.blocked_employees];
  const positions = new Map<string, { label: string; dept: string; payrollType: string }>();
  for (const person of people) {
    if (!person.position_code || !person.position_label) continue;
    const dept =
      person.location_label === "Dapur Pusat"
        ? "DEPT_DAPUR"
        : person.location_label === "Outlet"
          ? "DEPT_OUTLET"
          : "DEPT_UMUM";
    const payrollType = person.pay_group_code === "WEEKLY_DAPUR" ? "weekly_hourly" : "monthly_split";
    if (!positions.has(person.position_code)) {
      positions.set(person.position_code, { label: person.position_label, dept, payrollType });
    }
  }
  for (const [code, pos] of positions) {
    await sql.query(
      `INSERT INTO positions (department_id, name, code, payroll_type)
       SELECT d.id, $2, $3, $4 FROM departments d WHERE d.code = $1
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
      [pos.dept, pos.label, code, pos.payrollType],
    );
  }

  const components: [string, string, string][] = [
    ["GAPOK", "Gaji pokok", "earning_fixed"],
    ["TUNJ_KEHADIRAN", "Tunjangan kehadiran", "earning_fixed"],
    ["TUNJ_TRANSPORT", "Tunjangan transport", "earning_fixed"],
    ["TUNJ_JABATAN", "Tunjangan jabatan", "earning_fixed"],
    ["UPAH_JAM", "Upah per jam", "earning_hourly"],
    ["UPAH_HARIAN", "Upah per hari", "earning_daily"],
    ["LEMBUR", "Lembur", "earning_variable"],
    ["KASBON", "Kasbon", "deduction"],
  ];
  for (const [code, name, type] of components) {
    await sql.query(
      `INSERT INTO salary_components (code, name, component_type) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING`,
      [code, name, type],
    );
  }

  const shifts: [string, string, string, string, string, string][] = [
    ["P1", "Shift 1 / pagi", "regular", "06:00", "16:00", "inherit"],
    ["P2", "Shift 2 / siang", "regular", "11:30", "21:30", "inherit"],
    ["MID", "Middle", "regular", "09:30", "19:30", "inherit"],
    ["S3", "Shift 3", "regular", "12:30", "21:30", "inherit"],
    ["BACKUP", "Shift backup", "backup", "00:00", "00:00", "none"],
  ];
  for (const [code, name, kind, start, end, late] of shifts) {
    await sql.query(
      `INSERT INTO shift_templates (code, name, shift_kind, start_time, end_time, late_policy)
       VALUES ($1, $2, $3, $4::time, $5::time, $6)
       ON CONFLICT (code) DO NOTHING`,
      [code, name, kind, start, end, late],
    );
  }

  const stages: [string, string, number, number][] = [
    ["training_1m", "Training 1 bulan", 1, 1],
    ["training_3m", "Training 3 bulan", 3, 2],
    ["contract_1y", "Kontrak 1 tahun", 12, 3],
  ];
  for (const [code, name, months, sort] of stages) {
    await sql.query(
      `INSERT INTO contract_stage_options (code, name, duration_months, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING`,
      [code, name, months, sort],
    );
  }

  const readyRows = new Set(doc.ready_employees.map((p) => p.source_row));
  let active = 0;
  let draft = 0;
  for (const person of people) {
    const isActive = readyRows.has(person.source_row);
    const note = [
      person.compensation_text ? `kompensasi_sumber=${person.compensation_text}` : null,
      person.block_reasons?.length ? `blokir=${person.block_reasons.join("; ")}` : null,
      "validasi_sebelum_production=ya",
    ]
      .filter(Boolean)
      .join(" | ");
    await sql.query(
      `INSERT INTO employees (
         full_name, employee_number, position_id, location_id, pay_group_id,
         join_date, record_status, source_row, source_note, in_payroll,
         validation_required, has_login, supervisor_employee_id
       )
       SELECT $1, $2, p.id, l.id, g.id, $3::date, $4, $5, $6, $7, TRUE, FALSE, NULL
       FROM (SELECT 1) AS dummy
       LEFT JOIN positions p ON p.code = $8
       LEFT JOIN locations l ON l.code = $9
       LEFT JOIN pay_groups g ON g.code = $10
       ON CONFLICT (source_row) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         employee_number = EXCLUDED.employee_number,
         position_id = EXCLUDED.position_id,
         location_id = EXCLUDED.location_id,
         pay_group_id = EXCLUDED.pay_group_id,
         join_date = EXCLUDED.join_date,
         record_status = EXCLUDED.record_status,
         source_note = EXCLUDED.source_note,
         in_payroll = EXCLUDED.in_payroll,
         validation_required = TRUE,
         supervisor_employee_id = NULL,
         updated_at = now()`,
      [
        person.full_name,
        person.employee_number,
        person.join_date,
        isActive ? "active" : "draft",
        person.source_row,
        note,
        isActive,
        person.position_code,
        person.location_code,
        person.pay_group_code,
      ],
    );
    if (isActive) active += 1;
    else draft += 1;
  }
  console.log(`Roster: active=${active} draft=${draft} payroll_runs=0`);

  if (!actorId) {
    console.log("Nilai pengaturan dilewati karena superadmin belum ada.");
    return;
  }

  const rules: [string, string, string | null][] = [
    ["WEEKLY_DAPUR", "raw_clock_in", null],
    ["MONTHLY_DAPUR_OFFICE", "raw_clock_in", null],
    ["MONTHLY_OUTLET", "raw_clock_in", null],
    ["MONTHLY_KANTOR", "raw_clock_in", null],
  ];
  for (const [code, basis, clamp] of rules) {
    await sql.query(
      `INSERT INTO pay_rules (
         pay_group_id, effective_from, hours_basis, earliest_count_time,
         late_deduction_mode, source_ref, notes
       )
       SELECT id, DATE '2026-11-06', $2, $3::time, 'none', 'doc_erp_abs_stok', 'default scope, bukan tarif orang'
       FROM pay_groups WHERE code = $1
       ON CONFLICT (pay_group_id, effective_from) DO NOTHING`,
      [code, basis, clamp],
    );
  }

  await sql.query(
    `INSERT INTO setting_definitions (key, category, label, value_type, default_value, allowed_scopes, is_locked)
     VALUES
      ('attendance.late_deduction_mode', 'attendance', 'Mode denda telat', 'enum', '{"v":"none"}', '{org,pay_group,position,employee}', FALSE),
      ('weekly.total_hours_basis', 'weekly', 'Dasar jam dapur', 'enum', '{"v":"raw_clock_in"}', '{pay_group,position,employee}', FALSE),
      ('period.monthly_payday_day', 'period', 'Tanggal gaji bulanan', 'integer', '{"v":1}', '{pay_group}', FALSE),
      ('system.public_api', 'system', 'API publik', 'boolean', '{"v":false}', '{org}', TRUE)
     ON CONFLICT (key) DO NOTHING`,
  );
  await sql.query(
    `INSERT INTO setting_values (
       definition_id, scope_type, scope_id, value, effective_from, status, source_ref, reason, created_by
     )
     SELECT d.id, 'org', NULL, d.default_value, DATE '2026-11-06', 'active', 'doc_erp_abs_stok', 'seed default lembaga', $1::bigint
     FROM setting_definitions d
     WHERE NOT EXISTS (
       SELECT 1 FROM setting_values v
       WHERE v.definition_id = d.id AND v.scope_type = 'org' AND v.status = 'active'
     )`,
    [actorId],
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const doc = JSON.parse(readFileSync(join(process.cwd(), "refs/seed-hrd.json"), "utf8")) as SeedDoc;
  const sql = await openSql(url);
  const actorId = await seedBaseline(sql, doc.org_profile);
  await seedCatalog(sql, doc, actorId);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "seed failed");
  process.exit(1);
});
