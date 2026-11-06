# CLAUDE.md — CRM Relawan Nusantara

## Project Overview

CRM untuk Yayasan Relawan Nusantara (charity). Mengelola donatur, transaksi donasi, blast campaign WhatsApp, prospecting, dan segmentasi donor berbasis RFM.

## Tech Stack

- **Framework:** Next.js 15 App Router — SSR first, NO SPA
- **Language:** TypeScript strict
- **Database:** PostgreSQL 15+ via Neon DB serverless (`@neondatabase/serverless`)
- **Hosting:** Vercel (region: sin1 Singapore)
- **Storage:** Vercel Blob (imports, exports, reports)
- **UI:** shadcn/ui + Tailwind CSS 4 + Lucide React icons
- **Auth:** next-auth (Credentials provider, JWT session)

## Critical Rules — NEVER Break These

### 1. NO ORM — Raw SQL Only
- ALL database queries are raw SQL in `lib/db/queries/*.ts`
- Drizzle is ONLY for `drizzle-kit generate` (migration) and `drizzle-kit migrate` (apply)
- NEVER import from `drizzle-orm` in application code
- NEVER write SQL inside API routes or components — always call query functions from `lib/db/queries/`

### 2. NO SPA — SSR First
- Default to Server Components (no `"use client"` directive)
- `"use client"` ONLY for: forms, modals, charts (Recharts), query builder, drag-and-drop, interactive tables
- Data fetching in Server Components via async/await — NEVER `useEffect` + `fetch`
- Every page exports `metadata` for SEO

### 3. Database Schema
- Primary keys: `BIGSERIAL` — NO UUID anywhere
- Lookup/status fields: `VARCHAR` — NO database ENUM types
- Soft delete via `deleted_at TIMESTAMPTZ` (donors, programs, campaigns)
- `audit_logs` table is immutable — INSERT only, no UPDATE/DELETE
- Phone numbers stored as `62xxxxxxxxxx` in `no_hp_canonical`

### 4. Search Index Pattern
- ALL donor filter/search queries MUST go through `donor_search_index` table
- NEVER query `transactions` table directly to filter donors
- After any donor or transaction change, call `fn_rebuild_search_index(donor_id)`
- `program_participation` in search_doc uses `programs.slug` as key (immutable)

### 5. API Route Pattern
```
app/api/{resource}/route.ts → GET (list), POST (create)
app/api/{resource}/[id]/route.ts → GET (detail), PUT (update), DELETE (soft)
```
Every route must:
1. Check session via `getServerSession()`
2. Check RBAC via `checkPermission(role, resource, action)`
3. Validate input via Zod schema
4. Call query function from `lib/db/queries/`
5. Log mutation to `audit_logs` via `logAudit()`
6. Return typed JSON response

### 6. File Organization
```
lib/db/queries/     → Raw SQL query functions (one file per model)
lib/db/index.ts     → Neon DB connection
lib/validators/     → Zod schemas
lib/auth/           → next-auth config, session helper, RBAC
lib/utils/          → Phone normalization, formatting, blob helpers
components/ui/      → shadcn/ui primitives (DO NOT modify)
components/layout/  → Sidebar, header, mobile nav
components/data-table/ → Reusable table with sort/filter/select/bulk
components/query-builder/ → Multi-condition filter builder
components/forms/   → Form components per entity
components/donor/   → Donor-specific components
components/dashboard/ → Chart/stat components
components/shared/  → Cross-cutting reusable components
hooks/              → Custom React hooks
types/              → TypeScript type definitions
```

## Conventions

### Naming
- Files: `kebab-case.ts` (e.g., `blast-records.ts`, `data-table.tsx`)
- Components: `PascalCase` (e.g., `DataTable`, `QueryBuilder`)
- Functions: `camelCase` (e.g., `getDonorById`, `listBlastBatches`)
- DB columns: `snake_case` (e.g., `no_hp_canonical`, `follow_up_status`)
- API routes: `kebab-case` paths (e.g., `/api/blast-batches`, `/api/field-definitions`)
- Zod schemas: `{action}{Entity}Schema` (e.g., `createDonorSchema`, `updateCampaignSchema`)

### SQL Query Functions
```typescript
// lib/db/queries/donors.ts
import { getDb } from '../index';

// Always return typed results
export async function getDonorById(id: bigint): Promise<DonorRow | null> {
  const sql = getDb();
  const rows = await sql`SELECT ... FROM donors WHERE id = ${id}`;
  return rows[0] ?? null;
}

// List functions accept options object
export async function listDonors(opts: ListDonorsOptions): Promise<PaginatedResult<DonorRow>> {
  // ...
}
```

### Component Pattern
```typescript
// Server Component (default)
export default async function DonorsPage() {
  const donors = await listDonors({ page: 1, limit: 25 });
  return <DonorTable data={donors} />;
}

// Client Component (only when needed)
"use client";
export function DonorForm({ donor }: { donor?: DonorRow }) {
  // Interactive form with shadcn/ui Form + Zod
}
```

### Error Handling
- API routes return `{ error: string }` with appropriate HTTP status
- Use `NextResponse.json()` — not `Response.json()`
- Zod validation errors: `{ error: parsed.error.flatten() }` with 400
- Auth errors: 401 (unauthenticated), 403 (unauthorized)
- Not found: 404
- Server errors: 500 with generic message (no stack trace in response)

## Design System

- **Primary:** `#01665a` (teal)
- **Sidebar:** bg `#01665a`, text white
- **Font:** Source Sans Pro (self-hosted)
- **Icons:** Lucide React — NO emoji except ✓ checkmark
- **Logo:** URL with `referrerPolicy="no-referrer"` + `crossOrigin="anonymous"` + `onError` → Shield icon fallback
- **Tables:** Use reusable `DataTable` component with shadcn/ui Table
- **Forms:** shadcn/ui Form + Zod resolver
- **Toasts:** sonner (shadcn/ui compatible)
- **Mobile:** Sidebar overlay with backdrop on < 768px, auto-close on nav

## RBAC Roles

| Role | Access Level |
|---|---|
| `admin` | Full access to everything |
| `supervisor` | Read + assign + import/export, no config |
| `data_analyst` | Read + query + import/export |
| `tim_blast` | Worklist + prospect notes only |
| `read_only` | Read-only access to data |

## 21 Database Tables

`app_config`, `users`, `user_tokens`, `programs`, `campaigns`, `donors`, `transactions`, `field_definitions`, `donor_dynamic_fields`, `donor_search_index`, `prospect_notes`, `vendor_profiles`, `blast_batches`, `blast_records`, `saved_segments`, `saved_segment_results`, `donor_assignment_history`, `distribute_batches`, `data_imports`, `audit_logs`, `extension_configs`

Full DDL: see `erd_single_v2.md`

## Key Dependencies (do not remove)
```json
{
  "recharts": "charts",
  "@dnd-kit/core": "drag-and-drop",
  "@dnd-kit/sortable": "drag-and-drop",
  "jspdf": "PDF export",
  "jspdf-autotable": "PDF tables",
  "exceljs": "XLSX import/export",
  "@tiptap/react": "rich text editor",
  "next-auth": "authentication",
  "zod": "validation",
  "sonner": "toast notifications",
  "nuqs": "URL query state",
  "date-fns": "date formatting",
  "libphonenumber-js": "phone normalization"
}
```

## Performance Targets
- Simple query (1-3 conditions): < 500ms
- Complex query (5+ conditions): < 3s
- Donor profile page load: < 2s
- Extension sidebar: < 1s
- Import 50k rows: < 5 min
- Export 50k rows: < 30s
- RFM recalculation (full): < 10 min
- Auto-distribute 5k donors: < 30s

## Common Tasks

### Add a new API endpoint
1. Create route file in `app/api/{resource}/route.ts`
2. Create query function in `lib/db/queries/{resource}.ts`
3. Create Zod schema in `lib/validators/{resource}.ts`
4. Add RBAC permissions in `lib/auth/rbac.ts`
5. Add audit logging for mutations

### Add a new page
1. Create page in `app/(dashboard)/{page}/page.tsx` (Server Component)
2. Add to sidebar nav config in `components/layout/sidebar.tsx`
3. Use `DataTable` for list views
4. Use shadcn/ui components for forms
5. Export `metadata` for SEO

### Add a dynamic field
1. Admin creates via `/api/field-definitions` (POST)
2. Values stored in `donor_dynamic_fields` (EAV)
3. If `is_searchable: true` → auto-included in `search_doc.dynamic`
4. No deployment needed — works immediately

### Run database migration
```bash
npx drizzle-kit generate  # Generate SQL migration from schema changes
npx drizzle-kit migrate   # Apply to Neon DB
npx tsx drizzle/seed.ts   # Re-run idempotent seed
```
