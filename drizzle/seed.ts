import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { BANK_NAMES, TAX_STATUSES } from "../lib/hrd/static-options";

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
    ["OFF", "Libur", "regular", "00:00", "00:00", "none"],
    ["CUSTOM", "Jam khusus", "regular", "08:00", "18:00", "inherit"],
  ];
  for (const [code, name, kind, start, end, late] of shifts) {
    await sql.query(
      `INSERT INTO shift_templates (code, name, shift_kind, start_time, end_time, late_policy)
       VALUES ($1, $2, $3, $4::time, $5::time, $6)
       ON CONFLICT (code) DO NOTHING`,
      [code, name, kind, start, end, late],
    );
  }

  const ranks: [string, string, number][] = [
    ["CREW", "Crew", 10],
    ["STAFF", "Staff", 20],
    ["SPV", "Supervisor", 30],
    ["MANAGER", "Manager", 40],
  ];
  for (const [code, name, sort] of ranks) {
    await sql.query(
      `INSERT INTO ranks (code, name, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()`,
      [code, name, sort],
    );
  }

  // Seed Hari Libur Nasional & Tanggal Merah Indonesia Des 2026 - Des 2027
  const holidays: [string, string, boolean][] = [
    ["2026-12-25", "Hari Raya Natal", false],
    ["2026-12-26", "Cuti Bersama Hari Raya Natal", false],
    ["2027-01-01", "Tahun Baru 2027 Masehi", false],
    ["2027-01-20", "Isra Mikraj Nabi Muhammad SAW", false],
    ["2027-02-06", "Tahun Baru Imlek 2578 Kongzili", false],
    ["2027-03-08", "Hari Suci Nyepi (Tahun Baru Saka 1949)", false],
    ["2027-03-09", "Hari Raya Idul Fitri 1448 H (Hari 1)", false],
    ["2027-03-10", "Hari Raya Idul Fitri 1448 H (Hari 2)", false],
    ["2027-03-11", "Cuti Bersama Hari Raya Idul Fitri 1448 H", false],
    ["2027-03-12", "Cuti Bersama Hari Raya Idul Fitri 1448 H", false],
    ["2027-03-26", "Wafat Yesus Kristus (Jumat Agung)", false],
    ["2027-03-28", "Kebangkitan Yesus Kristus (Paskah)", true],
    ["2027-05-01", "Hari Buruh Internasional", false],
    ["2027-05-06", "Kenaikan Yesus Kristus", false],
    ["2027-05-16", "Hari Raya Idul Adha 1448 H", true],
    ["2027-05-20", "Hari Raya Waisak 2571 BE", false],
    ["2027-06-01", "Hari Lahir Pancasila", false],
    ["2027-06-06", "Tahun Baru Islam 1449 Hijriah", true],
    ["2027-08-15", "Maulid Nabi Muhammad SAW", true],
    ["2027-08-17", "Hari Kemerdekaan Republik Indonesia ke-82", false],
    ["2027-12-25", "Hari Raya Natal", false],
    ["2027-12-26", "Cuti Bersama Hari Raya Natal", true],
  ];
  for (const [date, hName, isSun] of holidays) {
    await sql.query(
      `INSERT INTO holidays (holiday_date, name, is_sunday)
       VALUES ($1::date, $2, $3)
       ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name, is_sunday = EXCLUDED.is_sunday`,
      [date, hName, isSun],
    );
  }
  await sql.query(
    `INSERT INTO setting_definitions (key, category, label, value_type, default_value, allowed_scopes, is_locked)
     VALUES ('contract.remind_days', 'contract', 'Hari pengingat akhir kontrak', 'integer', '{"v":30}', '{org}', FALSE)
     ON CONFLICT (key) DO NOTHING`,
  );

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
    const empType = person.pay_group_code === "WEEKLY_DAPUR" ? "dapur" : (person.pay_group_code === "MONTHLY_KANTOR" ? "office" : "outlet");
    await sql.query(
      `INSERT INTO employees (
         full_name, employee_number, position_id, location_id, pay_group_id,
         join_date, record_status, source_row, source_note, in_payroll,
         validation_required, has_login, supervisor_employee_id, employee_type
       )
       SELECT $1, $2, p.id, l.id, g.id, $3::date, $4, $5, $6, $7, TRUE, FALSE, NULL, $11
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
         employee_type = EXCLUDED.employee_type,
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
        empType,
      ],
    );
    if (isActive) active += 1;
    else draft += 1;
  }
  await seedDemoProfiles(sql);
  console.log(`Roster: active=${active} draft=${draft} payroll_runs=0`);
  await seedOutletNovember(sql, actorId);

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
      ('attendance.late_deduction_rate', 'attendance', 'Tarif denda telat per menit (Rupiah)', 'integer', '{"v":1000}', '{org,pay_group,position,employee}', FALSE),
      ('weekly.total_hours_basis', 'weekly', 'Dasar jam dapur', 'enum', '{"v":"raw_clock_in"}', '{pay_group,position,employee}', FALSE),
      ('period.monthly_payday_day', 'period', 'Tanggal gaji bulanan', 'integer', '{"v":1}', '{pay_group}', FALSE),
      ('contract.remind_days', 'contract', 'Hari pengingat akhir kontrak', 'integer', '{"v":null}', '{org}', FALSE),
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

  // Pasang aturan per_minute rate 1000 untuk pay_group MONTHLY_OUTLET
  const outletGroup = rowsOf(await sql.query(`SELECT id FROM pay_groups WHERE code = 'MONTHLY_OUTLET' LIMIT 1`))[0];
  const lateModeDef = rowsOf(await sql.query(`SELECT id FROM setting_definitions WHERE key = 'attendance.late_deduction_mode' LIMIT 1`))[0];
  const lateRateDef = rowsOf(await sql.query(`SELECT id FROM setting_definitions WHERE key = 'attendance.late_deduction_rate' LIMIT 1`))[0];
  if (outletGroup && lateModeDef && lateRateDef) {
    await sql.query(
      `INSERT INTO setting_values (
         definition_id, scope_type, scope_id, value, effective_from, status, source_ref, reason, created_by
       )
       VALUES
         ($1::bigint, 'pay_group', $2::bigint, '{"v":"per_minute"}', DATE '2026-11-06', 'active', 'doc_erp_abs_stok', 'aturan telat outlet per menit', $3::bigint),
         ($4::bigint, 'pay_group', $2::bigint, '{"v":1000}', DATE '2026-11-06', 'active', 'doc_erp_abs_stok', 'tarif telat outlet 1000/menit', $3::bigint)
       ON CONFLICT DO NOTHING`,
      [lateModeDef.id, outletGroup.id, actorId, lateRateDef.id],
    );
  }
}

function isoDate(value: unknown) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

async function seedDemoProfiles(sql: Sql) {
  const ranks = rowsOf(await sql.query(`SELECT id, code FROM ranks WHERE deleted_at IS NULL ORDER BY sort_order`));
  const positions = rowsOf(await sql.query(`SELECT id FROM positions WHERE deleted_at IS NULL ORDER BY name`));
  const groups = rowsOf(await sql.query(`SELECT id FROM pay_groups ORDER BY name`));
  const locations = rowsOf(await sql.query(`SELECT id FROM locations WHERE deleted_at IS NULL ORDER BY name`));
  const stages = rowsOf(
    await sql.query(`SELECT id, code FROM contract_stage_options ORDER BY sort_order`),
  );
  const gapok = rowsOf(await sql.query(`SELECT id FROM salary_components WHERE code = 'GAPOK' LIMIT 1`));
  const actor = rowsOf(await sql.query(`SELECT id FROM users ORDER BY id LIMIT 1`));
  const employees = rowsOf(
    await sql.query(
      `SELECT id, full_name, employee_number, join_date, position_id, pay_group_id, location_id, rank_id
       FROM employees WHERE deleted_at IS NULL ORDER BY id`,
    ),
  );
  const usedNums = new Set(
    employees.map((e) => String(e.employee_number ?? "")).filter((n) => /^CW\d{3}$/.test(n)),
  );
  let seq = 1;
  const nextCw = () => {
    while (usedNums.has(`CW${String(seq).padStart(3, "0")}`)) seq += 1;
    const code = `CW${String(seq).padStart(3, "0")}`;
    usedNums.add(code);
    seq += 1;
    return code;
  };

  const genders = ["female", "male"] as const;
  const maritals = ["married", "unmarried", "married", "divorced"] as const;
  const empStatus = ["permanent", "contract", "contract", "training"] as const;
  const levels = ["SMA", "SMK", "D3", "S1"] as const;
  const supervisorId =
    employees.find((e) => String(e.full_name).toLowerCase().includes("manager") || String(e.full_name).toLowerCase().includes("dahlia"))
      ?.id ?? employees[0]?.id;

  for (let i = 0; i < employees.length; i += 1) {
    const e = employees[i];
    const id = String(e.id);
    const number = e.employee_number ? String(e.employee_number) : nextCw();
    const fallbackJoin = `2024-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`;
    const join = isoDate(e.join_date) ?? fallbackJoin;
    const birthY = 1988 + (i % 12);
    const birth = `${birthY}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`;
    const rank = ranks[i % Math.max(ranks.length, 1)];
    const pos = e.position_id ?? positions[i % Math.max(positions.length, 1)]?.id;
    const group = e.pay_group_id ?? groups[i % Math.max(groups.length, 1)]?.id;
    const loc = e.location_id ?? locations[i % Math.max(locations.length, 1)]?.id;
    const boss = supervisorId && String(supervisorId) !== id ? supervisorId : null;
    await sql.query(
      `UPDATE employees SET
         employee_number = COALESCE(employee_number, $2),
         gender = COALESCE(gender, $3),
         marital_status = COALESCE(marital_status, $4),
         employment_status = COALESCE(NULLIF(employment_status, 'contract'), $5, employment_status),
         birth_date = COALESCE(birth_date, $6::date),
         address = COALESCE(address, $7),
         join_date = COALESCE(join_date, $8::date),
         rank_id = COALESCE(rank_id, $9::bigint),
         position_id = COALESCE(position_id, $10::bigint),
         pay_group_id = COALESCE(pay_group_id, $11::bigint),
         location_id = COALESCE(location_id, $12::bigint),
         supervisor_employee_id = COALESCE(supervisor_employee_id, $13::bigint),
         bank_name = COALESCE(bank_name, $14),
         bank_account_number = COALESCE(bank_account_number, $15),
         bank_account_name = COALESCE(bank_account_name, $16),
         npwp = COALESCE(npwp, $17),
         bpjs_kesehatan_id = COALESCE(bpjs_kesehatan_id, $18),
         bpjs_tk_id = COALESCE(bpjs_tk_id, $19),
         tax_status = COALESCE(tax_status, $20),
         updated_at = now()
       WHERE id = $1::bigint`,
      [
        id,
        number,
        genders[i % 2],
        maritals[i % maritals.length],
        empStatus[i % empStatus.length],
        birth,
        `Jl. Raya Baros No. ${12 + i}, Kec. Baros`,
        join,
        rank ? String(rank.id) : null,
        pos ? String(pos) : null,
        group ? String(group) : null,
        loc ? String(loc) : null,
        boss ? String(boss) : null,
        BANK_NAMES[i % BANK_NAMES.length],
        `8801${String(100000 + i).slice(-6)}`,
        String(e.full_name),
        `${String(10 + (i % 89)).padStart(2, "0")}0${String(1000000 + i).slice(-7)}${String(100 + i).slice(-3)}000`.slice(0, 15),
        `000${String(10_000_000_000 + i).slice(-10)}`,
        `00${String(1_000_000_000 + i).slice(-9)}`,
        TAX_STATUSES[i % TAX_STATUSES.length],
      ],
    );

    const edu = await sql.query(`SELECT 1 FROM employee_educations WHERE employee_id = $1 LIMIT 1`, [id]);
    if (!edu.length) {
      await sql.query(
        `INSERT INTO employee_educations (employee_id, level, institution, major, start_year, end_year)
         VALUES ($1::bigint, $2, $3, $4, $5, $6)`,
        [
          id,
          levels[i % levels.length],
          i % 2 === 0 ? "SMKN 1 Sukabumi" : "Universitas Muhammadiyah Sukabumi",
          i % 2 === 0 ? "Tata Boga" : "Manajemen",
          birthY + 16,
          birthY + 19,
        ],
      );
    }

    const fam = await sql.query(`SELECT 1 FROM employee_family_members WHERE employee_id = $1 LIMIT 1`, [id]);
    if (!fam.length) {
      const rel = genders[i % 2] === "female" ? "husband" : "wife";
      await sql.query(
        `INSERT INTO employee_family_members (employee_id, relation, full_name, birth_date)
         VALUES ($1::bigint, $2, $3, $4::date)`,
        [id, rel, `Keluarga ${String(e.full_name).split(" ")[0]}`, `${birthY + 2}-05-12`],
      );
      if (i % 2 === 0) {
        await sql.query(
          `INSERT INTO employee_family_members (employee_id, relation, full_name, birth_date)
           VALUES ($1::bigint, 'child', $2, $3::date)`,
          [id, `Anak ${String(e.full_name).split(" ")[0]}`, `${2015 + (i % 8)}-08-20`],
        );
      }
    }

    const con = await sql.query(`SELECT 1 FROM employment_contracts WHERE employee_id = $1 LIMIT 1`, [id]);
    const s1 = stages.find((s) => s.code === "training_1m");
    const s3 = stages.find((s) => s.code === "training_3m");
    const sy = stages.find((s) => s.code === "contract_1y");
    if (!con.length && s1 && s3 && sy) {
      const start = new Date(`${join}T00:00:00Z`);
      const d1 = new Date(start);
      d1.setUTCMonth(d1.getUTCMonth() + 1);
      const d3 = new Date(d1);
      d3.setUTCMonth(d3.getUTCMonth() + 3);
      const dY = new Date(d3);
      dY.setUTCFullYear(dY.getUTCFullYear() + 1);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      await sql.query(
        `INSERT INTO employment_contracts (employee_id, stage_option_id, sequence_no, start_date, end_date, status, created_by)
         VALUES
           ($1::bigint, $2::bigint, 1, $5::date, $6::date, 'completed', $9::bigint),
           ($1::bigint, $3::bigint, 2, $6::date, $7::date, 'completed', $9::bigint),
           ($1::bigint, $4::bigint, 3, $7::date, $8::date, 'active', $9::bigint)`,
        [
          id,
          String(s1.id),
          String(s3.id),
          String(sy.id),
          iso(start),
          iso(d1),
          iso(d3),
          iso(dY),
          actor[0] ? String(actor[0].id) : null,
        ],
      );
    }

    if (gapok[0]) {
      const sc = await sql.query(
        `SELECT 1 FROM employee_salary_components WHERE employee_id = $1 AND salary_component_id = $2 LIMIT 1`,
        [id, String(gapok[0].id)],
      );
      if (!sc.length) {
        await sql.query(
          `INSERT INTO employee_salary_components (employee_id, salary_component_id, amount, effective_from)
           VALUES ($1::bigint, $2::bigint, $3, $4::date)`,
          [id, String(gapok[0].id), 2_500_000 + i * 150_000, join],
        );
      }
    }
  }
  await sql.query(
    `UPDATE employment_contracts c
     SET end_date = CURRENT_DATE + (((c.id % 18)::int + 7) * INTERVAL '1 day')
     WHERE c.status = 'active'
       AND c.employee_id IN (
         SELECT id FROM employees WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 4
       )`,
  );
}

function matchCrewAlias(fullName: string, alias: string) {
  const n = fullName.toLowerCase();
  if (alias === "rafli") return n.includes("rafly") || n.includes("rafli");
  if (alias === "reyhan") return n.includes("reyhaan") || n.includes("reyhan");
  return n.includes(alias);
}

async function seedOutletNovember(sql: Sql, actorId: string | null) {
  const existingUser = await sql.query(
    `SELECT id FROM users WHERE deleted_at IS NULL ORDER BY id LIMIT 1`,
  );
  let actor = actorId ?? (existingUser[0] ? String(existingUser[0].id) : null);
  if (!actor) {
    const created = await sql.query(
      `INSERT INTO users (nama, email, password_hash, role, is_active)
       VALUES ('Pencatat jadwal', 'seed-schedule@local', '!', 'superordinat', FALSE)
       ON CONFLICT (email) DO UPDATE SET deleted_at = NULL
       RETURNING id`,
    );
    actor = created[0] ? String(created[0].id) : null;
  }
  if (!actor) {
    console.log("Jadwal November dilewati karena assigned_by tidak tersedia.");
    return;
  }
  const people = await sql.query(
    `SELECT e.id, e.full_name FROM employees e WHERE e.deleted_at IS NULL`,
  );
  const outlet = await sql.query(`SELECT id FROM pay_groups WHERE code = 'MONTHLY_OUTLET' LIMIT 1`);
  const outletId = outlet[0] ? String(outlet[0].id) : null;
  const find = (alias: string) =>
    people.find((p) => matchCrewAlias(String(p.full_name), alias));
  const tpls = await sql.query(`SELECT id, code, shift_kind FROM shift_templates WHERE deleted_at IS NULL`);
  const byCode = new Map(tpls.map((t) => [String(t.code), t]));
  const parse = (token: string) => {
    const v = token.trim().toLowerCase();
    if (v === "s1") return { code: "P1", status: "work", start: null as string | null, end: null as string | null, notes: null as string | null };
    if (v === "s2") return { code: "P2", status: "work", start: null, end: null, notes: null };
    if (v === "off") return { code: "OFF", status: "off", start: null, end: null, notes: null };
    if (v === "req") return { code: "OFF", status: "off", start: null, end: null, notes: "permintaan" };
    if (v === "izin") return { code: "OFF", status: "off_izin", start: null, end: null, notes: null };
    if (v.startsWith("jam:")) {
      const [start, end] = v.slice(4).split("-");
      return { code: "CUSTOM", status: "work", start, end, notes: null };
    }
    return null;
  };
  const cells: [string, number, string][] = [
    ["dahlia", 2, "off"], ["dahlia", 8, "off"], ["dahlia", 15, "off"],
    ["nasir", 2, "s1"], ["nasir", 3, "req"], ["nasir", 4, "s2"], ["nasir", 5, "s2"], ["nasir", 6, "s2"], ["nasir", 7, "s2"],
    ["nasir", 8, "jam:08:00-18:00"], ["nasir", 9, "off"], ["nasir", 10, "s2"], ["nasir", 11, "s1"], ["nasir", 12, "s1"],
    ["nasir", 13, "s1"], ["nasir", 14, "s1"], ["nasir", 15, "s1"], ["nasir", 16, "req"],
    ["vanesa", 2, "s1"], ["vanesa", 3, "req"], ["vanesa", 4, "s1"], ["vanesa", 5, "s1"], ["vanesa", 6, "s1"], ["vanesa", 7, "s1"],
    ["vanesa", 8, "s1"], ["vanesa", 9, "s1"], ["vanesa", 10, "off"], ["vanesa", 11, "s2"], ["vanesa", 12, "s2"], ["vanesa", 13, "s2"],
    ["vanesa", 14, "s2"], ["vanesa", 15, "s2"], ["vanesa", 16, "req"],
    ["airi", 2, "s2"], ["airi", 3, "s1"], ["airi", 4, "req"], ["airi", 5, "s2"], ["airi", 6, "s2"], ["airi", 7, "s2"], ["airi", 8, "s2"],
    ["airi", 9, "s2"], ["airi", 10, "s2"], ["airi", 11, "off"], ["airi", 12, "s1"], ["airi", 13, "s1"], ["airi", 14, "s1"], ["airi", 15, "s1"],
    ["refa", 2, "s2"], ["refa", 3, "s2"], ["refa", 4, "s2"], ["refa", 5, "s2"], ["refa", 6, "off"], ["refa", 7, "s2"], ["refa", 8, "s2"],
    ["refa", 9, "s2"], ["refa", 10, "s1"], ["refa", 11, "s2"], ["refa", 12, "s2"], ["refa", 13, "s2"], ["refa", 14, "req"], ["refa", 15, "s2"],
    ["iman", 2, "s2"], ["iman", 3, "s2"], ["iman", 4, "s2"], ["iman", 5, "req"], ["iman", 6, "s2"], ["iman", 7, "s2"], ["iman", 8, "s2"],
    ["iman", 9, "s2"], ["iman", 10, "s2"], ["iman", 11, "s1"], ["iman", 12, "off"], ["iman", 13, "s2"], ["iman", 14, "s2"], ["iman", 15, "s2"],
    ["rafli", 2, "off"], ["rafli", 3, "s2"], ["rafli", 4, "s1"], ["rafli", 5, "s1"], ["rafli", 6, "s1"], ["rafli", 7, "s1"], ["rafli", 8, "s1"],
    ["rafli", 9, "off"], ["rafli", 10, "s2"], ["rafli", 11, "s2"], ["rafli", 12, "s2"], ["rafli", 13, "s2"], ["rafli", 14, "s2"], ["rafli", 15, "s2"],
    ["rafli", 20, "req"],
    ["iqbal", 2, "s2"], ["iqbal", 3, "s2"], ["iqbal", 4, "req"], ["iqbal", 5, "s2"], ["iqbal", 6, "s2"], ["iqbal", 7, "s2"], ["iqbal", 8, "s2"],
    ["iqbal", 9, "s1"], ["iqbal", 10, "off"], ["iqbal", 11, "s2"], ["iqbal", 12, "s1"], ["iqbal", 13, "s1"], ["iqbal", 14, "s1"], ["iqbal", 15, "s1"],
    ["iqbal", 22, "off"],
    ["reyhan", 2, "s1"], ["reyhan", 3, "s1"], ["reyhan", 4, "s1"], ["reyhan", 5, "req"], ["reyhan", 6, "s2"], ["reyhan", 7, "s2"], ["reyhan", 8, "s2"],
    ["reyhan", 9, "s2"], ["reyhan", 10, "s1"], ["reyhan", 11, "s1"], ["reyhan", 12, "off"], ["reyhan", 13, "s2"], ["reyhan", 14, "s2"], ["reyhan", 15, "s2"],
    ["yuli", 2, "s1"], ["yuli", 3, "s1"], ["yuli", 4, "s1"], ["yuli", 5, "s1"], ["yuli", 6, "s1"], ["yuli", 7, "req"], ["yuli", 8, "s2"],
    ["yuli", 9, "s2"], ["yuli", 10, "s2"], ["yuli", 11, "s2"], ["yuli", 12, "s2"], ["yuli", 13, "s2"], ["yuli", 14, "off"], ["yuli", 15, "s2"],
    ["herni", 2, "off"], ["herni", 3, "izin"], ["herni", 4, "s2"], ["herni", 5, "s2"], ["herni", 6, "s2"], ["herni", 7, "s2"], ["herni", 8, "s2"],
    ["herni", 9, "s2"], ["herni", 10, "s2"], ["herni", 11, "off"], ["herni", 12, "s2"], ["herni", 13, "s2"], ["herni", 14, "s2"], ["herni", 15, "s1"],
    ["hesti", 2, "s2"], ["hesti", 3, "s2"], ["hesti", 4, "s2"], ["hesti", 5, "s2"], ["hesti", 6, "req"], ["hesti", 7, "s1"], ["hesti", 8, "s1"],
    ["hesti", 9, "s1"], ["hesti", 10, "s1"], ["hesti", 11, "s1"], ["hesti", 12, "s1"], ["hesti", 13, "s1"], ["hesti", 14, "s1"], ["hesti", 15, "off"],
    ["hesti", 16, "s2"],
  ];
  const aliases = [...new Set(cells.map((c) => c[0]))];
  for (const alias of aliases) {
    const emp = find(alias);
    if (emp && outletId) {
      await sql.query(`UPDATE employees SET pay_group_id = $2::bigint, updated_at = now() WHERE id = $1::bigint`, [
        String(emp.id),
        outletId,
      ]);
    }
  }
  let saved = 0;
  const missing = new Set<string>();
  for (const [alias, day, token] of cells) {
    const emp = find(alias);
    if (!emp) {
      missing.add(alias);
      continue;
    }
    const parsed = parse(token);
    if (!parsed) continue;
    const tpl = byCode.get(parsed.code);
    if (!tpl) continue;
    const date = `2026-11-${String(day).padStart(2, "0")}`;
    await sql.query(
      `INSERT INTO shift_assignments (
         employee_id, shift_template_id, work_date, day_status, is_backup,
         start_time, end_time, assigned_by, notes
       ) VALUES ($1::bigint, $2::bigint, $3::date, $4, $5, $6::time, $7::time, $8::bigint, $9)
       ON CONFLICT (employee_id, work_date) DO UPDATE SET
         shift_template_id = EXCLUDED.shift_template_id,
         day_status = EXCLUDED.day_status,
         is_backup = EXCLUDED.is_backup,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         notes = EXCLUDED.notes,
         updated_at = now()`,
      [
        String(emp.id),
        String(tpl.id),
        date,
        parsed.status,
        String(tpl.shift_kind) === "backup",
        parsed.start,
        parsed.end,
        actor,
        parsed.notes,
      ],
    );
    saved += 1;
  }
  if (missing.size) console.log(`Jadwal November: nama tidak ketemu ${[...missing].join(", ")}`);
  console.log(`Jadwal November 2026: ${saved} sel (tanpa Hitung SO)`);
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
