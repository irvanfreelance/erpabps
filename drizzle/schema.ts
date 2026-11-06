import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  char,
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
  role: varchar("role", { length: 50 }).notNull().default("tim_blast"),
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

export const programs = pgTable("programs", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  nama: varchar("nama", { length: 200 }).notNull(),
  deskripsi: text("deskripsi"),
  kategori: varchar("kategori", { length: 50 }).notNull().default("reguler"),
  periodeMulai: date("periode_mulai"),
  periodeSelesai: date("periode_selesai"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdBy: bigint("created_by", { mode: "bigint" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  nama: varchar("nama", { length: 300 }).notNull(),
  deskripsi: text("deskripsi"),
  programId: bigint("program_id", { mode: "bigint" }),
  tipe: varchar("tipe", { length: 50 }).notNull().default("blast"),
  tglMulai: date("tgl_mulai"),
  tglSelesai: date("tgl_selesai"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: bigint("created_by", { mode: "bigint" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const donors = pgTable(
  "donors",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    noHpCanonical: varchar("no_hp_canonical", { length: 20 }).notNull().unique(),
    noHpVariants: text("no_hp_variants").array().notNull().default([]),
    namaLengkap: varchar("nama_lengkap", { length: 300 }).notNull(),
    email: varchar("email", { length: 255 }),
    tglRegistrasi: date("tgl_registrasi"),
    sumberRegistrasi: varchar("sumber_registrasi", { length: 50 }).notNull().default("manual"),
    linkedZainsIds: text("linked_zains_ids").array().notNull().default([]),
    zainsIdPrimer: varchar("zains_id_primer", { length: 100 }),
    statusKontak: varchar("status_kontak", { length: 30 }).notNull().default("aktif"),
    segmenRfm: varchar("segmen_rfm", { length: 30 }),
    skorR: smallint("skor_r"),
    skorF: smallint("skor_f"),
    skorM: smallint("skor_m"),
    rfmUpdatedAt: ts("rfm_updated_at"),
    tags: text("tags").array().notNull().default([]),
    assignedTo: bigint("assigned_to", { mode: "bigint" }),
    followUpStatus: varchar("follow_up_status", { length: 30 }),
    followUpDueDate: date("follow_up_due_date"),
    assignedAt: ts("assigned_at"),
    lastDonationAt: date("last_donation_at"),
    lastDonationNominal: bigint("last_donation_nominal", { mode: "bigint" }),
    lastDonationProgramId: bigint("last_donation_program_id", { mode: "bigint" }),
    totalDonationLifetime: bigint("total_donation_lifetime", { mode: "bigint" }).notNull().default(sql`0`),
    totalDonationCount: integer("total_donation_count").notNull().default(0),
    lastSyncedAt: ts("last_synced_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
);

export const transactions = pgTable("transactions", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  donorId: bigint("donor_id", { mode: "bigint" }).notNull(),
  programId: bigint("program_id", { mode: "bigint" }).notNull(),
  campaignId: bigint("campaign_id", { mode: "bigint" }),
  idTransaksiZains: varchar("id_transaksi_zains", { length: 100 }),
  idTransaksiCf: varchar("id_transaksi_cf", { length: 100 }),
  tglTransaksi: date("tgl_transaksi").notNull(),
  bulanProgram: char("bulan_program", { length: 7 }).notNull(),
  nominal: bigint("nominal", { mode: "bigint" }).notNull().default(sql`0`),
  status: varchar("status", { length: 30 }).notNull().default("paid"),
  sumber: varchar("sumber", { length: 30 }).notNull().default("upload"),
  catatan: text("catatan"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const fieldDefinitions = pgTable("field_definitions", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 200 }).notNull(),
  tipe: varchar("tipe", { length: 30 }).notNull(),
  optionsJson: jsonb("options_json").notNull().default([]),
  isRequired: boolean("is_required").notNull().default(false),
  isSearchable: boolean("is_searchable").notNull().default(true),
  visibleInJson: jsonb("visible_in_json").notNull().default(["profil", "list", "export"]),
  editableByJson: jsonb("editable_by_json").notNull().default(["admin", "supervisor", "data_analyst"]),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: bigint("created_by", { mode: "bigint" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const donorDynamicFields = pgTable("donor_dynamic_fields", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  donorId: bigint("donor_id", { mode: "bigint" }).notNull(),
  fieldDefId: bigint("field_def_id", { mode: "bigint" }).notNull(),
  valueText: text("value_text"),
  valueNumber: numeric("value_number", { precision: 18, scale: 2 }),
  valueDate: date("value_date"),
  valueBoolean: boolean("value_boolean"),
  valueJson: jsonb("value_json"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: bigint("updated_by", { mode: "bigint" }),
});

export const donorSearchIndex = pgTable("donor_search_index", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  donorId: bigint("donor_id", { mode: "bigint" }).notNull().unique(),
  searchDoc: jsonb("search_doc").notNull().default({}),
  searchVector: text("search_vector"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const prospectNotes = pgTable("prospect_notes", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  donorId: bigint("donor_id", { mode: "bigint" }).notNull(),
  userId: bigint("user_id", { mode: "bigint" }).notNull(),
  campaignId: bigint("campaign_id", { mode: "bigint" }),
  tglProspek: date("tgl_prospek").notNull(),
  channel: varchar("channel", { length: 50 }).notNull().default("manual"),
  responDonatur: varchar("respon_donatur", { length: 50 }),
  catatanBebas: text("catatan_bebas"),
  source: varchar("source", { length: 30 }).notNull().default("web_app"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const vendorProfiles = pgTable("vendor_profiles", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  namaVendor: varchar("nama_vendor", { length: 100 }).notNull(),
  columnMapping: jsonb("column_mapping").notNull().default({}),
  statusMapping: jsonb("status_mapping").notNull().default({}),
  isDefault: boolean("is_default").notNull().default(false),
  createdBy: bigint("created_by", { mode: "bigint" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const blastBatches = pgTable("blast_batches", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  campaignId: bigint("campaign_id", { mode: "bigint" }),
  vendorProfileId: bigint("vendor_profile_id", { mode: "bigint" }),
  tglBlast: date("tgl_blast").notNull(),
  jumlahTarget: integer("jumlah_target").notNull().default(0),
  jumlahTerkirim: integer("jumlah_terkirim").notNull().default(0),
  jumlahGagal: integer("jumlah_gagal").notNull().default(0),
  jumlahDibaca: integer("jumlah_dibaca").notNull().default(0),
  jumlahRespon: integer("jumlah_respon").notNull().default(0),
  jumlahClosing: integer("jumlah_closing").notNull().default(0),
  fileLaporanPath: varchar("file_laporan_path", { length: 500 }),
  importStatus: varchar("import_status", { length: 30 }).notNull().default("pending"),
  importError: text("import_error"),
  diimportOleh: bigint("diimport_oleh", { mode: "bigint" }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const blastRecords = pgTable("blast_records", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  donorId: bigint("donor_id", { mode: "bigint" }).notNull(),
  blastBatchId: bigint("blast_batch_id", { mode: "bigint" }).notNull(),
  tglKirim: ts("tgl_kirim"),
  statusKirim: varchar("status_kirim", { length: 30 }).notNull().default("terkirim"),
  dibaca: boolean("dibaca"),
  respon: varchar("respon", { length: 30 }).notNull().default("belum"),
  rawVendorStatus: varchar("raw_vendor_status", { length: 200 }),
  catatan: text("catatan"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const savedSegments = pgTable("saved_segments", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  nama: varchar("nama", { length: 200 }).notNull(),
  deskripsi: text("deskripsi"),
  queryJson: jsonb("query_json").notNull().default({}),
  isPublic: boolean("is_public").notNull().default(false),
  autoRefresh: boolean("auto_refresh").notNull().default(false),
  refreshSchedule: varchar("refresh_schedule", { length: 20 }).notNull().default("manual"),
  lastCount: integer("last_count"),
  lastRefreshedAt: ts("last_refreshed_at"),
  dibuatOleh: bigint("dibuat_oleh", { mode: "bigint" }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const savedSegmentResults = pgTable("saved_segment_results", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  segmentId: bigint("segment_id", { mode: "bigint" }).notNull(),
  donorId: bigint("donor_id", { mode: "bigint" }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const donorAssignmentHistory = pgTable("donor_assignment_history", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  donorId: bigint("donor_id", { mode: "bigint" }).notNull(),
  assignedFrom: bigint("assigned_from", { mode: "bigint" }),
  assignedTo: bigint("assigned_to", { mode: "bigint" }),
  assignedBy: bigint("assigned_by", { mode: "bigint" }),
  batchDistributeId: bigint("batch_distribute_id", { mode: "bigint" }),
  reason: varchar("reason", { length: 200 }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const distributeBatches = pgTable("distribute_batches", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  segmentId: bigint("segment_id", { mode: "bigint" }),
  totalDonors: integer("total_donors").notNull().default(0),
  picCount: integer("pic_count").notNull().default(0),
  configJson: jsonb("config_json").notNull().default({}),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  dijalankanOleh: bigint("dijalankan_oleh", { mode: "bigint" }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  completedAt: ts("completed_at"),
});

export const dataImports = pgTable("data_imports", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  fileName: varchar("file_name", { length: 300 }),
  filePath: varchar("file_path", { length: 500 }),
  rowCountTotal: integer("row_count_total").notNull().default(0),
  rowCountNew: integer("row_count_new").notNull().default(0),
  rowCountMerge: integer("row_count_merge").notNull().default(0),
  rowCountSkip: integer("row_count_skip").notNull().default(0),
  rowCountError: integer("row_count_error").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  errorLog: text("error_log"),
  blastBatchId: bigint("blast_batch_id", { mode: "bigint" }),
  diuploadOleh: bigint("diupload_oleh", { mode: "bigint" }).notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  completedAt: ts("completed_at"),
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

export const extensionConfigs = pgTable("extension_configs", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  extType: varchar("ext_type", { length: 50 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(false),
  configJson: jsonb("config_json").notNull().default({}),
  status: varchar("status", { length: 30 }).notNull().default("idle"),
  lastRunAt: ts("last_run_at"),
  lastRunStatus: varchar("last_run_status", { length: 30 }),
  errorLog: text("error_log"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const tagDefinitions = pgTable("tag_definitions", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  nama: varchar("nama", { length: 120 }).notNull(),
  warna: varchar("warna", { length: 7 }).notNull().default("#01665a"),
  deskripsi: text("deskripsi"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

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
