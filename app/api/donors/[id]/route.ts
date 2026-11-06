import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { updateDonorSchema } from "@/lib/validators/donor";

async function donorById(id: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT d.*, u.nama AS assigned_nama, p.nama AS last_donation_program_nama, p.slug AS last_donation_program_slug
    FROM donors d
    LEFT JOIN users u ON u.id = d.assigned_to
    LEFT JOIN programs p ON p.id = d.last_donation_program_id
    WHERE d.id = ${id} AND d.deleted_at IS NULL
  `;
  return jsonSafe(rows[0] ?? null);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("donors", "read");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const row = await donorById(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("donors", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = updateDonorSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const patch = parsed.data as Record<string, unknown>;
  const sql = getDb();
  const nama = (patch.namaLengkap as string) ?? null;
  const email = (patch.email as string) ?? null;
  const status = (patch.statusKontak as string) ?? null;
  const assignedTo = (patch.assignedTo as string) ?? null;
  const followUp = (patch.followUpStatus as string) ?? null;
  const due = (patch.followUpDueDate as string) ?? null;
  const tags = (patch.tags as string[]) ?? null;
  await sql`
    UPDATE donors SET
      nama_lengkap = COALESCE(${nama}, nama_lengkap),
      email = COALESCE(${email}, email),
      status_kontak = COALESCE(${status}, status_kontak),
      assigned_to = COALESCE(${assignedTo}::bigint, assigned_to),
      follow_up_status = COALESCE(${followUp}, follow_up_status),
      follow_up_due_date = COALESCE(${due}::date, follow_up_due_date),
      tags = COALESCE(${tags}::text[], tags)
    WHERE id = ${id}
  `;
  await sql`SELECT fn_rebuild_search_index(${id}::bigint)`;
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "donor", entityId: id, valueAfter: parsed.data });
  return NextResponse.json(await donorById(id));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("donors", "delete");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  await sql`UPDATE donors SET deleted_at = now() WHERE id = ${id}`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "donor", entityId: id });
  return NextResponse.json({ success: true });
}
