# Technical Requirements Document (TRD)

## CRM Relawan Nusantara — v1.0

**Project:** CRM RN
**Client:** Yayasan Relawan Nusantara
**Developer:** CNT (Creative Nusantara Technology)
**Date:** 2026-10-22
**References:** PRD CRM RN v2, ERD Single Tenant v2, UI Mockup Artifacts

---

## 1. Technology Stack

### 1.1 Core Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.x | SSR-first, no SPA — setiap halaman server-rendered |
| Runtime | Node.js | 20 LTS | |
| Language | TypeScript | 5.x | Strict mode enabled |
| Database | PostgreSQL | 15+ | Via Neon DB serverless |
| DB Driver | @neondatabase/serverless | latest | HTTP/WebSocket driver, NOT node-postgres |
| Migration | Drizzle Kit | latest | `drizzle-kit generate` + `drizzle-kit migrate` ONLY |
| Seed | Drizzle (custom script) | — | Idempotent seed via `drizzle-kit` or raw SQL runner |
| Hosting | Vercel | — | Edge + Serverless Functions |
| Storage | Vercel Blob | — | Image & file storage (laporan vendor, export, avatar) |
| UI Library | shadcn/ui | latest | Tailwind CSS 4 + Radix primitives |
| Icons | Lucide React | latest | No emoji in UI except ✓ checkmark |

### 1.2 Additional Dependencies

| Package | Purpose |
|---|---|
| `recharts` | Dashboard charts — bar, line, pie, area |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop untuk reorder field definitions, query conditions, assignment |
| `jspdf` + `jspdf-autotable` | PDF export (laporan blast, profil donatur) |
| `exceljs` | XLSX export & import parsing (donatur, transaksi, laporan blast) |
| `@tiptap/react` + extensions | Rich text editor untuk prospect notes, catatan bebas |
| `next-auth` | Authentication — credential provider + session management |
| `zod` | Schema validation — API input, form, import row |
| `sonner` | Toast notifications (shadcn/ui compatible) |
| `nuqs` | URL query state management (filter, pagination, sort) |
| `date-fns` | Date formatting & manipulation (Indonesian locale) |
| `libphonenumber-js` | Phone number normalization (→ format 62xxxxxxxxxx) |

### 1.3 Development Dependencies

| Package | Purpose |
|---|---|
| `drizzle-orm` + `drizzle-kit` | Migration generation & execution ONLY — **NEVER used as ORM** |
| `eslint` + `prettier` | Linting + formatting |
| `vitest` | Unit testing |
| `playwright` | E2E testing |

---

## 2. Architecture

### 2.1 Project Structure

```
crm-rn/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Authenticated layout + sidebar
│   │   ├── page.tsx                      # Dashboard (redirect or overview)
│   │   ├── dashboard/page.tsx            # Statistics dashboard
│   │   ├── worklist/page.tsx             # PIC worklist
│   │   ├── donors/
│   │   │   ├── page.tsx                  # Donor list + query builder
│   │   │   └── [id]/page.tsx             # Donor profile (tabs)
│   │   ├── programs/page.tsx
│   │   ├── campaigns/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── segments/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── blast-batches/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── prospect-notes/page.tsx
│   │   ├── vendor-profiles/page.tsx
│   │   ├── field-definitions/page.tsx
│   │   ├── users/page.tsx
│   │   ├── data-imports/page.tsx
│   │   ├── extensions/page.tsx
│   │   └── app-config/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── donors/
│   │   │   ├── route.ts                  # GET (list+search), POST (create)
│   │   │   ├── [id]/route.ts             # GET, PUT, DELETE (soft)
│   │   │   ├── [id]/notes/route.ts       # GET, POST prospect notes
│   │   │   ├── [id]/transactions/route.ts
│   │   │   ├── [id]/blasts/route.ts
│   │   │   ├── [id]/dynamic-fields/route.ts
│   │   │   ├── search/route.ts           # POST — advanced query via search_index
│   │   │   ├── assign/route.ts           # POST — bulk assign/unassign/migrate
│   │   │   └── export/route.ts           # POST — CSV/XLSX export
│   │   ├── programs/route.ts             # CRUD
│   │   ├── campaigns/route.ts            # CRUD
│   │   ├── transactions/
│   │   │   ├── route.ts                  # GET (list), POST (create)
│   │   │   └── [id]/route.ts
│   │   ├── segments/
│   │   │   ├── route.ts                  # GET, POST
│   │   │   ├── [id]/route.ts             # GET, PUT, DELETE
│   │   │   ├── [id]/execute/route.ts     # POST — run segment query
│   │   │   └── [id]/refresh/route.ts     # POST — refresh cached results
│   │   ├── blast-batches/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── import/route.ts           # POST — import vendor report
│   │   ├── blast-records/route.ts
│   │   ├── prospect-notes/route.ts
│   │   ├── vendor-profiles/route.ts
│   │   ├── field-definitions/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── users/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── data-imports/
│   │   │   ├── route.ts
│   │   │   └── upload/route.ts           # POST — file upload + parse
│   │   ├── distribute/route.ts           # POST — auto-distribute donors
│   │   ├── rfm/recalculate/route.ts      # POST — trigger RFM recalc
│   │   ├── search-index/rebuild/route.ts # POST — rebuild search index
│   │   ├── audit-logs/route.ts           # GET only
│   │   ├── app-config/route.ts           # GET, PUT
│   │   ├── extension-configs/route.ts    # CRUD — Chrome extension selectors
│   │   ├── upload/route.ts               # POST — Vercel Blob upload
│   │   └── health/route.ts               # GET — health check
│   ├── layout.tsx                        # Root layout
│   └── globals.css
├── lib/
│   ├── db/
│   │   ├── index.ts                      # Neon DB connection (getDb)
│   │   ├── audit.ts                      # logAudit insert only — not a query pool
│   │   └── migrations/                   # Drizzle-generated SQL migrations
│   │                                     # Raw SQL lives in app/api/{model}/route.ts
│   ├── auth/
│   │   ├── index.ts                      # next-auth config
│   │   ├── session.ts                    # getServerSession helper
│   │   └── rbac.ts                       # Permission check utilities
│   ├── validators/                       # Zod schemas
│   │   ├── donor.ts
│   │   ├── transaction.ts
│   │   ├── query-builder.ts
│   │   ├── import.ts
│   │   └── ...
│   ├── utils/
│   │   ├── phone.ts                      # HP normalization (libphonenumber)
│   │   ├── format.ts                     # Currency, date formatting
│   │   ├── export.ts                     # CSV/XLSX generation
│   │   ├── import-parser.ts              # CSV/XLSX import parsing
│   │   └── blob.ts                       # Vercel Blob helpers
│   └── constants.ts                      # App-wide constants
├── components/
│   ├── ui/                               # shadcn/ui primitives (auto-generated)
│   ├── layout/
│   │   ├── sidebar.tsx                   # Collapsible sidebar with nav groups
│   │   ├── header.tsx                    # Top bar with user menu
│   │   ├── mobile-nav.tsx                # Mobile overlay nav
│   │   └── breadcrumb.tsx
│   ├── data-table/
│   │   ├── data-table.tsx                # Reusable table with sort/filter/select
│   │   ├── data-table-toolbar.tsx
│   │   ├── data-table-pagination.tsx
│   │   ├── data-table-column-header.tsx
│   │   └── data-table-bulk-toolbar.tsx   # Bulk actions bar
│   ├── query-builder/
│   │   ├── query-builder.tsx             # Main query builder container
│   │   ├── condition-row.tsx             # Single condition (attribute/temporal/etc)
│   │   ├── condition-group.tsx           # AND/OR group
│   │   └── condition-types.ts            # 5 condition type definitions
│   ├── forms/
│   │   ├── donor-form.tsx
│   │   ├── transaction-form.tsx
│   │   ├── prospect-note-form.tsx
│   │   ├── field-definition-form.tsx
│   │   ├── vendor-profile-form.tsx
│   │   └── import-wizard.tsx             # Multi-step import flow
│   ├── donor/
│   │   ├── donor-profile.tsx             # Full profile with tabs
│   │   ├── donor-rfm-badge.tsx           # RFM segment badge
│   │   ├── donor-timeline.tsx            # Activity timeline
│   │   └── donor-dynamic-fields.tsx      # Dynamic field renderer
│   ├── dashboard/
│   │   ├── stat-card.tsx
│   │   ├── rfm-distribution-chart.tsx
│   │   ├── donation-trend-chart.tsx
│   │   ├── workload-chart.tsx
│   │   └── campaign-performance-chart.tsx
│   └── shared/
│       ├── logo.tsx                      # Logo with fallback to Shield icon
│       ├── page-header.tsx
│       ├── empty-state.tsx
│       ├── confirm-dialog.tsx
│       ├── file-upload-zone.tsx
│       └── rich-text-editor.tsx          # Tiptap wrapper
├── hooks/
│   ├── use-debounce.ts
│   ├── use-data-table.ts
│   ├── use-query-builder.ts
│   └── use-window-width.ts
├── types/
│   ├── database.ts                       # DB row types (matching ERD exactly)
│   ├── api.ts                            # API request/response types
│   ├── query-builder.ts                  # Query condition types
│   └── auth.ts                           # Session/user types
├── drizzle/
│   ├── schema.ts                         # Drizzle schema (migration generation ONLY)
│   ├── seed.ts                           # Idempotent seed script
│   └── drizzle.config.ts
├── public/
│   └── fonts/                            # Source Sans Pro (self-hosted)
├── extension/                            # Chrome Extension (separate build)
│   ├── manifest.json
│   ├── content.ts                        # Content script for web.whatsapp
│   ├── background.ts                     # Service worker
│   ├── sidebar/                          # Sidebar overlay React app
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── hooks/
│   └── popup/                            # Extension popup (login/settings)
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

### 2.2 Architectural Principles

**P1 — SSR First, No SPA**
- Semua halaman menggunakan Server Components by default
- Client Components (`"use client"`) HANYA untuk interaktivitas: form, query builder, charts, modals, drag-and-drop
- Data fetching via `async` Server Components yang memanggil handler route in-process — BUKAN `useEffect` + fetch di client, dan BUKAN `fetch` ke URL `/api` sendiri
- `loading.tsx` untuk setiap route segment yang butuh streaming
- SEO: setiap halaman punya `metadata` export dengan title + description

**P2 — Raw SQL, No ORM**
- Semua query SQL ditulis manual di `app/api/{model}/route.ts` (dan `[id]/route.ts` bila ada)
- Tidak ada folder `lib/db/queries`. Satu-satunya SQL di luar route adalah `logAudit` di `lib/db/audit.ts`
- Parameterized queries WAJIB — no string concatenation
- Drizzle HANYA untuk: `drizzle-kit generate` (migration) dan `drizzle-kit migrate` (apply)
- Drizzle schema (`drizzle/schema.ts`) hanya dipakai generate migration, NEVER import di app code

**P3 — Separation of Concerns**
- API routes (`app/api/`) → auth check + validasi Zod + raw SQL + JSON
- Server Components → render UI, panggil handler route di proses yang sama (`fromRoute`). Jangan `fetch("/api/...")` ke origin sendiri: itu hop HTTP ekstra dan memperlambat SSR
- No raw SQL di components atau halaman

**P4 — Reusable Components**
- `DataTable` — generic sortable, filterable, selectable table
- `QueryBuilder` — reusable multi-condition filter builder
- `ImportWizard` — reusable multi-step import flow
- Form components — composable with shadcn/ui Form + Zod
- All components responsive (mobile-first with Tailwind breakpoints)

### 2.3 Database Connection

```typescript
// lib/db/index.ts
import { neon } from '@neondatabase/serverless';

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// Raw SQL lives in the route, not a query module:
// app/api/donors/[id]/route.ts
import { getDb } from '@/lib/db';

const sql = getDb();
const rows = await sql`
  SELECT d.*, p.nama AS last_program_nama, p.slug AS last_program_slug
  FROM donors d
  LEFT JOIN programs p ON p.id = d.last_donation_program_id
  WHERE d.id = ${id} AND d.deleted_at IS NULL
`;
```

### 2.4 API Route Pattern

```typescript
// app/api/donors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { checkPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import { createDonorSchema } from '@/lib/validators/donor';
import { logAudit } from '@/lib/db/audit';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sql = getDb();
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 25;
  const rows = await sql`
    SELECT d.id, d.nama_lengkap, d.no_hp_canonical
    FROM donors d
    WHERE d.deleted_at IS NULL
    ORDER BY d.updated_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

  return NextResponse.json({ rows, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!checkPermission(session.user.role, 'donors', 'create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createDonorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sql = getDb();
  const inserted = await sql`
    INSERT INTO donors (no_hp_canonical, nama_lengkap, email, status_kontak, sumber_registrasi)
    VALUES (${parsed.data.noHpCanonical}, ${parsed.data.namaLengkap}, ${parsed.data.email ?? null}, ${parsed.data.statusKontak ?? 'aktif'}, 'manual')
    RETURNING *
  `;
  const donor = inserted[0];
  await logAudit({
    userId: session.user.id,
    donorId: donor.id,
    action: 'create',
    entityType: 'donor',
    entityId: donor.id,
    valueAfter: parsed.data,
    source: 'web_app',
  });

  return NextResponse.json(donor, { status: 201 });
}
```

---

## 3. Database Implementation

### 3.1 Schema Overview

Seluruh DDL mengikuti `erd_single_v2.md` — 21 tabel:

| # | Table | PK | Description |
|---|---|---|---|
| 1 | `app_config` | `key VARCHAR(100)` | Key-value config (rfm_window_months, etc) |
| 2 | `users` | `BIGSERIAL` | CRM users dengan RBAC role |
| 3 | `user_tokens` | `BIGSERIAL` | API tokens untuk Chrome Extension |
| 4 | `programs` | `BIGSERIAL` | Master program (ramadan, qurban, palestine, etc) — `slug UNIQUE` |
| 5 | `campaigns` | `BIGSERIAL` | Campaign per program per periode — `slug UNIQUE`, FK `program_id` |
| 6 | `donors` | `BIGSERIAL` | Donatur dengan denormalized stats + RFM scores |
| 7 | `transactions` | `BIGSERIAL` | Riwayat donasi — FK `donor_id`, `program_id`, `campaign_id` |
| 8 | `field_definitions` | `BIGSERIAL` | Definisi field dinamis (EAV schema) |
| 9 | `donor_dynamic_fields` | `BIGSERIAL` | Nilai field dinamis per donatur (EAV data) |
| 10 | `donor_search_index` | `BIGSERIAL` | Materialized JSONB index — **ALL filter queries use this** |
| 11 | `prospect_notes` | `BIGSERIAL` | Catatan prospek/follow-up per donatur |
| 12 | `vendor_profiles` | `BIGSERIAL` | Mapping kolom vendor blast (JSONB column_mapping) |
| 13 | `blast_batches` | `BIGSERIAL` | Batch blast campaign |
| 14 | `blast_records` | `BIGSERIAL` | Record per donatur per blast |
| 15 | `saved_segments` | `BIGSERIAL` | Query tersimpan (query_json JSONB) |
| 16 | `saved_segment_results` | `BIGSERIAL` | Cached segment member list |
| 17 | `donor_assignment_history` | `BIGSERIAL` | Audit trail assignment PIC |
| 18 | `distribute_batches` | `BIGSERIAL` | Auto-distribute batch records |
| 19 | `data_imports` | `BIGSERIAL` | Import job tracking |
| 20 | `audit_logs` | `BIGSERIAL` | Immutable audit trail (INSERT-only) |
| 21 | `extension_configs` | `BIGSERIAL` | Server-side DOM selectors untuk Chrome Extension |

### 3.2 Key Constraints

- **Primary Key:** `BIGSERIAL` — NO UUID anywhere
- **Lookup fields:** `VARCHAR` — NO database enums
- **Soft delete:** `deleted_at TIMESTAMPTZ` pada `donors`, `programs`, `campaigns`
- **Immutable tables:** `audit_logs` (INSERT-only, no UPDATE/DELETE trigger)
- **Temporal index:** `transactions.bulan_program CHAR(7)` — derived via trigger `fn_set_bulan_program()`
- **Phone normalization:** `donors.no_hp_canonical` format `62xxxxxxxxxx` — UNIQUE partial index WHERE deleted_at IS NULL

### 3.3 Critical Indexes (50+)

Lihat ERD Single v2 Section 4 untuk daftar lengkap. Key index strategy:

| Category | Index Type | Purpose |
|---|---|---|
| `donor_search_index.search_doc` | GIN JSONB | Semua filter query `@>`, `?`, `?|`, `?&` |
| `donor_search_index.search_vector` | GIN tsvector | Full-text search nama donatur |
| `donor_search_index.search_doc->'program_participation'` | GIN JSONB | Query temporal per program (KUNCI) |
| `donors.no_hp_canonical` | UNIQUE partial | Lookup HP (Chrome Extension + search bar) |
| `donors.nama_lengkap` | GIN trigram | ILIKE search nama |
| `transactions(program_id, bulan_program)` | B-tree partial | Query program + bulan (INDEX TERPENTING) |
| Expression indexes on search_doc | B-tree | Skip JSON parsing untuk field sering difilter |

### 3.4 Triggers & Functions (5)

| Function | Trigger | Description |
|---|---|---|
| `fn_set_bulan_program()` | `BEFORE INSERT/UPDATE ON transactions` | Auto-set `bulan_program` dari `tgl_transaksi` |
| `fn_update_donor_stats()` | `AFTER INSERT/UPDATE ON transactions` | Update denormalized donor stats |
| `fn_rebuild_search_index(donor_id)` | Called by API after donor/transaction change | Rebuild JSONB search doc — uses `programs.slug` as key |
| `fn_recalculate_rfm()` | Called by scheduled job / API trigger | NTILE(5) scoring → 7 segments |
| `fn_set_updated_at()` | `BEFORE UPDATE` on 12 tables | Auto-set `updated_at` |

### 3.5 Search Index Architecture

**RULE: Semua query filter donatur WAJIB melalui `donor_search_index`.**

Tidak boleh query `transactions` secara langsung untuk filter donatur. Alur:

```
Donor/Transaction change
  → API call fn_rebuild_search_index(donor_id)
    → Rebuild search_doc JSONB (flat document)
      → Query Builder queries search_doc via GIN indexes
```

`search_doc` structure:
```json
{
  "nama": "budi santoso",
  "no_hp": "6281234567890",
  "status": "aktif",
  "segmen": "at_risk",
  "tags": ["prioritas"],
  "skor_r": 2, "skor_f": 4, "skor_m": 4,
  "last_donation_date": "2025-03-15",
  "last_donation_program_slug": "ramadan",
  "last_donation_nominal": 500000,
  "total_donation_lifetime": 4250000,
  "total_donation_count": 8,
  "program_participation": {
    "ramadan": ["2023-Q1", "2024-Q1", "2025-Q1"],
    "qurban": ["2023-Q2", "2024-Q2"]
  },
  "assigned_to_id": 5,
  "follow_up_status": "in_progress",
  "dynamic": {
    "wilayah_donatur": "jabodetabek",
    "preferensi_program": ["ramadan", "qurban"]
  },
  "last_blast_at": "2025-06-01",
  "last_blast_response": "hanya_read"
}
```

### 3.6 Migration Strategy

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations to Neon DB
npx drizzle-kit migrate

# Run idempotent seed
npx tsx drizzle/seed.ts
```

- Migrations are SQL files in `lib/db/migrations/`
- Each migration is idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING)
- Seed data from ERD v2: 25 donors, 53 transactions, 19 campaigns, 10 programs, 15 prospect notes, 23 blast records
- Seed script uses raw SQL via Neon driver — NOT Drizzle ORM

---

## 4. Feature Implementation Map

### 4.1 Dashboard (SSR)

| PRD Ref | Feature | Implementation |
|---|---|---|
| US-MG-01 | Dashboard statistik | Server Component → query aggregate stats |
| | Total donatur aktif | `SELECT COUNT(*) FROM donors WHERE status_kontak = 'aktif' AND deleted_at IS NULL` |
| | Tren donasi bulanan | `SELECT bulan_program, SUM(nominal) FROM transactions WHERE status='paid' GROUP BY bulan_program ORDER BY bulan_program DESC LIMIT 12` |
| | Distribusi RFM | `SELECT segmen_rfm, COUNT(*) FROM donors WHERE deleted_at IS NULL GROUP BY segmen_rfm` |
| | Workload per PIC | `SELECT assigned_to, COUNT(*) FROM donors WHERE assigned_to IS NOT NULL AND deleted_at IS NULL GROUP BY assigned_to` |
| Charts | Recharts | `"use client"` wrapper components, data passed as props from Server Component |

### 4.2 Worklist PIC (SSR + Client Interactivity)

| PRD Ref | Feature | Implementation |
|---|---|---|
| US-TB-01 | Worklist prioritas | `SELECT * FROM v_donor_worklist WHERE assigned_to = $1 ORDER BY priority_score DESC` |
| US-TB-02 | Quick input respon | Client Component modal → POST `/api/donors/[id]/notes` |
| NFR-03 | Load < 2 detik | Paginated query (25/page), partial index on `assigned_to` |

### 4.3 Donor Management

#### 4.3.1 Donor List + Advanced Query Builder

| PRD Ref | Feature | Implementation |
|---|---|---|
| US-DA-03, US-DA-05 | Advanced multi-filter | Client Component `QueryBuilder` → POST `/api/donors/search` |
| | Query via search_index | Build JSONB query dynamically from conditions |

**5 Condition Types (from PRD):**

| Type | Label | SQL Pattern on `search_doc` |
|---|---|---|
| A | Attribute | `search_doc @> '{"status": "aktif"}'` or expression index |
| B | Transaction Absolute | `(search_doc->>'total_donation_count')::INT >= 3` |
| C | Temporal per Program | `search_doc->'program_participation'->'ramadan' ? '2025-Q1'` |
| D | Blast Activity | `(search_doc->>'last_blast_at')::DATE < CURRENT_DATE - INTERVAL '14 days'` |
| E | Assignment | `(search_doc->>'assigned_to_id')::BIGINT = 5` |

**Query Builder API:**

```typescript
// POST /api/donors/search
interface SearchRequest {
  conditions: Condition[];
  operator: 'AND' | 'OR';
  page: number;
  limit: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  exportFormat?: 'csv' | 'xlsx';  // triggers export instead of paginated response
}

interface Condition {
  type: 'attribute' | 'transaction' | 'temporal' | 'blast' | 'assignment';
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'has_key' | 'not_has_key';
  value: string | number | string[];
  program_slug?: string;  // for temporal type
}
```

```typescript
// app/api/donors/search/route.ts
export async function POST(req: NextRequest) {
  const { conditions, operator, page, limit } = await req.json();
  const sql = getDb();
  const whereClauses = conditions.map(buildWhereClause);
  const joined = whereClauses.join(operator === 'AND' ? ' AND ' : ' OR ');

  // Dynamic query built safely with parameterized values
  const rows = await sql`
    SELECT dsi.donor_id, dsi.search_doc,
           d.nama_lengkap, d.no_hp_canonical, d.email, d.status_kontak,
           d.segmen_rfm, d.last_donation_at, d.last_donation_nominal,
           d.total_donation_lifetime, d.total_donation_count, d.assigned_to
    FROM donor_search_index dsi
    JOIN donors d ON d.id = dsi.donor_id AND d.deleted_at IS NULL
    WHERE ${sql.unsafe(joined)}
    ORDER BY d.updated_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;
  // Count query for pagination
  const countRows = await sql`
    SELECT COUNT(*) as total FROM donor_search_index dsi
    JOIN donors d ON d.id = dsi.donor_id AND d.deleted_at IS NULL
    WHERE ${sql.unsafe(joined)}
  `;

  return { data: rows, total: Number(countRows[0].total), page, limit };
}
```

#### 4.3.2 Donor Profile (SSR with Client Tabs)

| Tab | Data Source | Implementation |
|---|---|---|
| Profil | `donors` + `programs` JOIN | Server Component fetch |
| Dynamic Fields | `donor_dynamic_fields` JOIN `field_definitions` | Server fetch + Client edit form |
| Riwayat Donasi | `transactions` JOIN `programs`, `campaigns` | Server Component, paginated |
| Catatan Prospek | `prospect_notes` | Server fetch + Client Tiptap form for add |
| Riwayat Blast | `blast_records` JOIN `blast_batches` | Server Component |
| Activity Log | `audit_logs` WHERE `donor_id` | Server Component |

#### 4.3.3 Bulk Assignment (US-SUP-02)

```typescript
// POST /api/donors/assign
interface AssignRequest {
  action: 'assign' | 'unassign' | 'migrate';
  donor_ids: bigint[];          // selected donor IDs
  target_user_id?: bigint;      // for assign/migrate
  source_user_id?: bigint;      // for migrate (from)
}
```

- `assign`: SET `assigned_to = target_user_id` + INSERT `donor_assignment_history`
- `unassign`: SET `assigned_to = NULL` + INSERT history
- `migrate`: SET `assigned_to = target_user_id` WHERE `assigned_to = source_user_id` + INSERT history

#### 4.3.4 Auto-Distribute (US-SUP-02)

```typescript
// POST /api/distribute
interface DistributeRequest {
  segment_id?: bigint;         // from saved segment
  donor_ids?: bigint[];        // or explicit list
  target_user_ids: bigint[];   // PIC targets
  strategy: 'round_robin' | 'equal';
}
```

Performance: < 30 detik untuk 5.000 donatur ke 10 PIC (NFR-09).
Implementation: batch UPDATE with `ROW_NUMBER() OVER () % target_count` for equal distribution.

### 4.4 Dynamic Fields (EAV + Materialized Column)

| PRD Ref | Feature | Implementation |
|---|---|---|
| NFR-10 | Admin tambah field tanpa deploy | POST `/api/field-definitions` → insert `field_definitions` |
| NFR-11 | Searchable field di Query Builder | `is_searchable = true` → included in `search_doc.dynamic` |
| NFR-12 | Deactivate tanpa hapus data | `is_active = false` → hidden from UI, data preserved |

**Field types supported:** `text`, `number`, `date`, `boolean`, `dropdown`, `multiselect`, `url`, `phone`

Stored in typed columns on `donor_dynamic_fields`:
- `value_text` → text, dropdown, url, phone
- `value_number` → number
- `value_date` → date
- `value_boolean` → boolean
- `value_json` → multiselect (array)

### 4.5 Import & Export

#### 4.5.1 Data Import (CSV/XLSX)

```
Upload → Parse (exceljs) → Normalize HP (libphonenumber) → Dedup check
→ Preview (new/merge/error) → Apply (atomic transaction) → Rebuild search index
```

| Step | Implementation |
|---|---|
| Upload | POST `/api/data-imports/upload` → Vercel Blob → create `data_imports` record |
| Parse | Server-side `exceljs` read → extract rows |
| Normalize | `libphonenumber-js` → format `62xxxxxxxxxx` |
| Dedup | Match on `no_hp_canonical` → classify new/merge/error |
| Preview | Return preview JSON to client for confirmation |
| Apply | Atomic: INSERT/UPDATE donors + transactions → rebuild search index |
| Tracking | Update `data_imports` status: `pending` → `processing` → `completed` / `failed` |

NFR-05: Import 50.000 baris < 5 menit — batch INSERT 1.000 rows per transaction.

#### 4.5.2 Export (CSV/XLSX)

- POST `/api/donors/export` with query conditions
- Server-side generation via `exceljs`
- Stream response for large exports
- NFR-06: Export 50.000 baris < 30 detik

#### 4.5.3 Blast Report Import

```
Upload vendor CSV → Map columns via VendorProfile → Parse status
→ Match donor by no_hp → Create blast_records → Update donor status
```

Column mapping stored in `vendor_profiles.column_mapping` (JSONB).
Status mapping in `vendor_profiles.status_mapping` (JSONB).

### 4.6 Segments

| Feature | Implementation |
|---|---|
| Create segment | Store `query_json` in `saved_segments` |
| Execute segment | POST `/api/segments/[id]/execute` → run query → cache in `saved_segment_results` |
| Auto-refresh | Scheduled job checks `refresh_schedule` + `auto_refresh = true` → re-execute |
| Generate blast list | Export segment results to CSV for vendor upload |

### 4.7 RFM Scoring

- Trigger: POST `/api/rfm/recalculate` (or after import completion)
- Function: `fn_recalculate_rfm()` — NTILE(5) scoring
- 7 segments: `champions`, `loyal`, `potential`, `at_risk`, `new`, `one_time`, `lost`
- Window: configurable via `app_config.rfm_window_months` (default 12)
- After RFM update: rebuild `donor_search_index` for affected donors
- NFR-08: Full recalc < 10 menit

### 4.8 Programs & Campaigns

| Table | API | Key Fields |
|---|---|---|
| `programs` | `/api/programs` | `slug` (UNIQUE, immutable), `nama`, `kategori`, `is_active` |
| `campaigns` | `/api/campaigns` | `slug` (UNIQUE), `program_id` (FK), `tgl_mulai`, `tgl_selesai` |

- Programs are master data — slug used as key in `program_participation`
- Campaigns belong to a program via FK
- Both support soft delete

---

## 5. Authentication & Authorization

### 5.1 Authentication

- **Provider:** next-auth with Credentials provider
- **Session:** JWT stored in httpOnly cookie
- **Timeout:** 8 jam inaktif (NFR-14)
- **Chrome Extension:** Per-user API token stored in `user_tokens` table, Chrome's `chrome.storage.local` (NOT localStorage)

### 5.2 RBAC — 5 Roles

| Role | Dashboard | Donors | Import | Export | Assign | Config | Audit |
|---|---|---|---|---|---|---|---|
| `admin` | ✓ | CRUD | ✓ | ✓ | ✓ | ✓ | ✓ |
| `supervisor` | ✓ | Read+Assign | ✓ | ✓ | ✓ | — | ✓ |
| `data_analyst` | ✓ | Read+Query | ✓ | ✓ | — | — | Read |
| `tim_blast` | Worklist | Read+Note | — | — | — | — | — |
| `read_only` | ✓ | Read | — | — | — | — | — |

Implementation:

```typescript
// lib/auth/rbac.ts
const PERMISSIONS: Record<string, Record<string, string[]>> = {
  admin:        { donors: ['read','create','update','delete','assign','export','import'], ... },
  supervisor:   { donors: ['read','assign','export','import'], ... },
  data_analyst: { donors: ['read','query','export','import'], ... },
  tim_blast:    { donors: ['read','note'], ... },
  read_only:    { donors: ['read'], ... },
};

export function checkPermission(role: string, resource: string, action: string): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false;
}
```

---

## 6. Chrome Extension (web.whatsapp Overlay)

### 6.1 Architecture

```
web.whatsapp.com DOM
  → Content Script (content.ts)
    → Extract No. HP via server-side selectors
    → Fetch donor profile from CRM API
    → Inject sidebar overlay (React app)
```

### 6.2 Tech Stack

| Component | Technology |
|---|---|
| Manifest | V3 |
| Content Script | TypeScript → injected into web.whatsapp.com |
| Sidebar UI | React + Tailwind (bundled separately) |
| API Communication | fetch to CRM API with user token |
| Storage | `chrome.storage.local` for token ONLY — NO localStorage/IndexedDB (NFR-19) |

### 6.3 Selector Strategy

Selectors stored server-side in `extension_configs` table:

```json
{
  "platform": "web_whatsapp",
  "selectors": {
    "phone_primary": "[data-id]",
    "phone_fallback": "span[title*='+']",
    "chat_header": "header._amid",
    "contact_name": "span[dir='auto']"
  },
  "version": "2.3",
  "is_active": true
}
```

- Extension fetches selectors from API on startup
- If auto-detect fails 3x → show manual input fallback
- Selectors updatable without extension reinstall (NFR-26)

### 6.4 Sidebar Features

| Feature | API Endpoint |
|---|---|
| Donor profile lookup | GET `/api/donors?hp={phone}` |
| Add prospect note | POST `/api/donors/[id]/notes` |
| Add/remove tag | PUT `/api/donors/[id]` (tags array) |
| Mark opt-out | PUT `/api/donors/[id]` (status_kontak: 'opt_out') |
| Open full profile | Link to CRM `/donors/[id]` |
| Add new donor | POST `/api/donors` (if not found) |

### 6.5 Quick Reply Templates

Stored in `extension_configs` with `config_type = 'quick_replies'`:

```json
{
  "templates": [
    { "label": "Greeting", "text": "Assalamualaikum {nama}, ..." },
    { "label": "Follow Up Qurban", "text": "Halo {nama}, kami ingin menginformasikan program Qurban ..." }
  ]
}
```

Support `{nama}` variable substitution from donor profile.

---

## 7. File Storage (Vercel Blob)

| File Type | Blob Path Pattern | Max Size |
|---|---|---|
| Import CSV/XLSX | `imports/{import_id}/{filename}` | 50MB |
| Export CSV/XLSX | `exports/{timestamp}_{segment}.xlsx` | 100MB |
| Vendor blast report | `blast-reports/{batch_id}/{filename}` | 50MB |
| PDF export | `pdf/{type}_{id}_{timestamp}.pdf` | 20MB |
| Donor avatar (future) | `avatars/{donor_id}.jpg` | 5MB |

```typescript
// lib/utils/blob.ts
import { put, del } from '@vercel/blob';

export async function uploadFile(file: File, path: string) {
  const blob = await put(path, file, { access: 'public' });
  return blob.url;
}
```

---

## 8. Performance Targets & Optimization

### 8.1 NFR Performance Mapping

| NFR | Target | Strategy |
|---|---|---|
| NFR-01 | Query 1–3 kondisi < 500ms | GIN index on search_doc, expression indexes |
| NFR-02 | Query 5+ kondisi < 3s | GIN on program_participation, parallel query |
| NFR-03 | Profil donatur < 2s | SSR with parallel data fetch, JOIN optimization |
| NFR-04 | Extension sidebar < 1s | Indexed lookup by no_hp_canonical, minimal payload |
| NFR-05 | Import 50k rows < 5min | Batch INSERT 1000/tx, async processing |
| NFR-06 | Export 50k rows < 30s | Stream response, exceljs streaming API |
| NFR-07 | Rebuild search_index/donor < 500ms | Single function call, indexed subqueries |
| NFR-08 | RFM full recalc < 10min | CTE with NTILE, batch UPDATE |
| NFR-09 | Distribute 5k donors < 30s | Single UPDATE with ROW_NUMBER |

### 8.2 Caching Strategy

| Layer | Strategy | TTL |
|---|---|---|
| Next.js | `revalidate` on Server Components | 60s for dashboard, 0 for donor data |
| API | `Cache-Control: private, no-cache` for dynamic data | — |
| Static assets | Vercel CDN auto-caching | Immutable |
| Search index | Materialized via `donor_search_index` | Rebuilt on change |

### 8.3 Database Optimization

- Connection pooling via Neon serverless driver (auto-managed)
- Partial indexes WHERE `deleted_at IS NULL` — reduces index size
- Expression indexes on `search_doc` fields — skip JSON parsing
- `LIMIT/OFFSET` pagination with indexed ORDER BY
- `LATERAL JOIN` for correlated subqueries (worklist view)

---

## 9. UI/UX Specifications

### 9.1 Design System

| Property | Value |
|---|---|
| Primary color | `#01665a` (teal) |
| Background | `#ffffff` |
| Font | Source Sans Pro (self-hosted, Google Fonts fallback) |
| Component library | shadcn/ui (default theme + primary color override) |
| Icons | Lucide React — NO emoji except ✓ |
| Responsive | Mobile-first, breakpoints: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px` |

### 9.2 Sidebar Navigation

```
4 groups:
├── OVERVIEW
│   ├── Dashboard
│   └── Worklist
├── CRM
│   ├── Donors
│   ├── Programs
│   ├── Campaigns
│   ├── Transactions
│   └── Segments
├── BLASTING
│   ├── Blast Batches
│   ├── Prospect Notes
│   └── Vendor Profiles
└── KONFIGURASI
    ├── Field Definitions
    ├── Users
    ├── Data Imports
    ├── Extensions
    └── App Config
```

- Collapsible sidebar with ChevronLeft/Menu toggle
- Mobile: overlay sidebar with backdrop, auto-close on navigation
- Sidebar bg: `#01665a`, text: white
- Logo with referrerPolicy="no-referrer" + onError fallback to Shield icon

### 9.3 Data Table Pattern

Every list page uses the reusable `DataTable` component:
- Column sorting (click header)
- Column filtering (dropdown per column)
- Row selection (checkbox)
- Bulk actions toolbar (appears when rows selected)
- Pagination (server-side)
- URL state management via `nuqs`

### 9.4 Responsive Rules

| Breakpoint | Layout |
|---|---|
| < 768px | Sidebar hidden (overlay toggle), single column, stacked cards |
| 768px – 1024px | Sidebar collapsed (icons only), 2-column grid |
| > 1024px | Sidebar expanded, full table layout |

---

## 10. Security

### 10.1 API Security

- All API routes require valid session (next-auth JWT)
- RBAC check on every mutating endpoint
- Zod validation on all request bodies
- Parameterized SQL queries — NEVER string concatenation
- Rate limiting via Vercel Edge Middleware (100 req/min per user)
- CORS: same-origin + extension origin

### 10.2 Data Security

- Soft delete (no hard delete except by admin explicit action)
- Audit log on all data mutations (immutable, INSERT-only)
- No PII in URLs or query parameters
- HTTPS only (enforced by Vercel)
- Environment variables via Vercel for all secrets

### 10.3 Extension Security (NFR-18, NFR-19, NFR-20)

- Per-user API token authentication (NOT shared credentials)
- Token stored in `chrome.storage.local` (NOT browser localStorage)
- Token refresh via extension popup login flow
- Extension reads DOM for phone number ONLY — NO chat content access
- All API calls via HTTPS to CRM backend

---

## 11. Deployment

### 11.1 Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "regions": ["sin1"],
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXTAUTH_SECRET": "@nextauth-secret",
    "NEXTAUTH_URL": "@nextauth-url",
    "BLOB_READ_WRITE_TOKEN": "@blob-token"
  },
  "crons": [
    {
      "path": "/api/rfm/recalculate",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/segments/auto-refresh",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

### 11.2 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon DB connection string (pooled) |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXTAUTH_URL` | App base URL |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token |

### 11.3 CI/CD

```
Push to main → Vercel auto-deploy
  → Build: next build
  → Migration: drizzle-kit migrate (via build script)
  → Deploy: Vercel serverless
```

### 11.4 Region

- Vercel: `sin1` (Singapore) — closest to Indonesia
- Neon DB: `ap-southeast-1` (Singapore)

---

## 12. Testing Strategy

| Type | Tool | Coverage Target |
|---|---|---|
| Unit | Vitest | Query functions, validators, utils (80%+) |
| Integration | Vitest + test DB | API routes end-to-end |
| E2E | Playwright | Critical flows: login, search, import, assign |
| Performance | Playwright + custom | NFR benchmarks (query time, import time) |

---

## 13. Glossary

| Term | Definition |
|---|---|
| SSR | Server-Side Rendering — HTML generated on server per request |
| EAV | Entity-Attribute-Value — dynamic field pattern |
| RFM | Recency-Frequency-Monetary — donor scoring model |
| GIN | Generalized Inverted Index — PostgreSQL index for JSONB/array/tsvector |
| PIC | Person-In-Charge — Tim Blast member assigned to donors |
| Segment | Saved query that returns a set of donors matching conditions |
| Search Index | Materialized JSONB document per donor for fast filtered queries |
| Slug | URL-safe immutable identifier (e.g. `ramadan`, `qurban-2025`) |
