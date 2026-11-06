import {
  bigint,
  bigserial,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const appConfig = pgTable("app_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  nama: varchar("nama", { length: 200 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("subordinat"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: ts("last_login_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
});

export const userTokens = pgTable("user_tokens", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  source: varchar("source", { length: 50 }).notNull().default("web_session"),
  label: varchar("label", { length: 100 }),
  lastUsedAt: ts("last_used_at"),
  expiresAt: ts("expires_at"),
  isRevoked: boolean("is_revoked").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const locations = pgTable("locations", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  radiusMeter: integer("radius_meter").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: ts("deleted_at"),
});

export const departments = pgTable("departments", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
});

export const positions = pgTable("positions", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  departmentId: bigint("department_id", { mode: "bigint" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  payrollType: varchar("payroll_type", { length: 40 }).notNull(),
});

export const payGroups = pgTable("pay_groups", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  payFrequency: varchar("pay_frequency", { length: 20 }).notNull(),
  weekStartDow: smallint("week_start_dow"),
  paydayDay: smallint("payday_day"),
  paydayDow: smallint("payday_dow"),
});

export const employees = pgTable("employees", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }).unique(),
  supervisorEmployeeId: bigint("supervisor_employee_id", { mode: "bigint" }),
  positionId: bigint("position_id", { mode: "bigint" }),
  locationId: bigint("location_id", { mode: "bigint" }),
  payGroupId: bigint("pay_group_id", { mode: "bigint" }),
  employeeNumber: varchar("employee_number", { length: 50 }).unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  joinDate: date("join_date"),
  recordStatus: varchar("record_status", { length: 20 }).notNull().default("draft"),
  sourceRow: integer("source_row").unique(),
  sourceNote: text("source_note"),
  inPayroll: boolean("in_payroll").notNull().default(false),
  validationRequired: boolean("validation_required").notNull().default(true),
  hasLogin: boolean("has_login").notNull().default(false),
  deletedAt: ts("deleted_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: bigint("user_id", { mode: "bigint" }),
  donorId: bigint("donor_id", { mode: "bigint" }),
  action: varchar("action", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: bigint("entity_id", { mode: "bigint" }),
  fieldChanged: varchar("field_changed", { length: 100 }),
  valueBefore: jsonb("value_before"),
  valueAfter: jsonb("value_after"),
  source: varchar("source", { length: 50 }).notNull().default("web_app"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Sisa tabel absensi, payroll, dan pengaturan ada di lib/db/migrations/0004_hrd_domain.sql.

export const orgProfile = pgTable("org_profile", {
  id: smallint("id").primaryKey().default(1),
  nama: varchar("nama", { length: 200 }).notNull(),
  namaSingkat: varchar("nama_singkat", { length: 40 }).notNull(),
  tagline: varchar("tagline", { length: 200 }).notNull().default(""),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: varchar("primary_color", { length: 7 }).notNull().default("#01665a"),
  sidebarColor: varchar("sidebar_color", { length: 7 }).notNull().default("#01665a"),
  accentColor: varchar("accent_color", { length: 7 }).notNull().default("#2e8b7a"),
  isSeedDefault: boolean("is_seed_default").notNull().default(true),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
