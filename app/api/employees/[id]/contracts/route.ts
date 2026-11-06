import { NextResponse } from "next/server";
import { guard, zodError } from "@/lib/api/guard";
import { actorUserId } from "@/lib/hrd/actor";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";
import { contractCreateSchema, contractPatchSchema } from "@/lib/validators/employee";

const NEXT: Record<string, string> = {
  training_1m: "training_3m",
  training_3m: "contract_1y",
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const body = await req.json();
  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });

  if (body?.advance) {
    const active = await sql`
      SELECT c.id, c.end_date, c.sequence_no, s.code
      FROM employment_contracts c
      JOIN contract_stage_options s ON s.id = c.stage_option_id
      WHERE c.employee_id = ${id}::bigint AND c.status = 'active'
      ORDER BY c.sequence_no DESC LIMIT 1
    `;
    const cur = active[0] as { id: string; end_date: string; sequence_no: number; code: string } | undefined;
    if (!cur) return NextResponse.json({ error: "Tidak ada kontrak aktif" }, { status: 400 });
    const nextCode = NEXT[cur.code];
    if (!nextCode) return NextResponse.json({ error: "Tahap terakhir sudah kontrak setahun" }, { status: 400 });
    const stage = await sql`SELECT id, duration_months FROM contract_stage_options WHERE code = ${nextCode}`;
    const st = stage[0] as { id: string; duration_months: number } | undefined;
    if (!st) return NextResponse.json({ error: "Katalog tahap berikutnya tidak ada" }, { status: 400 });
    await sql`UPDATE employment_contracts SET status = 'completed' WHERE id = ${cur.id}::bigint`;
    const start = String(cur.end_date).slice(0, 10);
    const rows = await sql`
      INSERT INTO employment_contracts (employee_id, stage_option_id, sequence_no, start_date, end_date, status, created_by)
      VALUES (
        ${id}::bigint, ${st.id}::bigint, ${Number(cur.sequence_no) + 1},
        ${start}::date, (${start}::date + (${st.duration_months} || ' months')::interval)::date,
        'active', ${actor}::bigint
      )
      RETURNING id, start_date, end_date, status
    `;
    await logAudit({ userId: g.session!.user.id, action: "advance", entityType: "employment_contract", entityId: String((rows[0] as { id: string }).id) });
    return NextResponse.json(jsonSafe(rows[0]));
  }

  const parsed = contractCreateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const stage = await sql`SELECT id, duration_months FROM contract_stage_options WHERE id = ${parsed.data.stageOptionId}::bigint`;
  const st = stage[0] as { id: string; duration_months: number } | undefined;
  if (!st) return NextResponse.json({ error: "Tahap tidak ditemukan" }, { status: 404 });
  const seq = await sql`SELECT COALESCE(MAX(sequence_no), 0)::int + 1 AS n FROM employment_contracts WHERE employee_id = ${id}::bigint`;
  const n = (seq[0] as { n: number }).n;
  await sql`UPDATE employment_contracts SET status = 'completed' WHERE employee_id = ${id}::bigint AND status = 'active'`;
  const rows = await sql`
    INSERT INTO employment_contracts (employee_id, stage_option_id, sequence_no, start_date, end_date, status, created_by)
    VALUES (
      ${id}::bigint, ${st.id}::bigint, ${n},
      ${parsed.data.startDate}::date,
      (${parsed.data.startDate}::date + (${st.duration_months} || ' months')::interval)::date,
      'active', ${actor}::bigint
    )
    RETURNING id, start_date, end_date, status
  `;
  await logAudit({ userId: g.session!.user.id, action: "create", entityType: "employment_contract", entityId: String((rows[0] as { id: string }).id) });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = contractPatchSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const sql = getDb();
  const d = parsed.data;
  if (d.status === "active") {
    await sql`UPDATE employment_contracts SET status = 'completed' WHERE employee_id = ${id}::bigint AND status = 'active' AND id <> ${d.contractId}::bigint`;
  }
  const rows = await sql`
    UPDATE employment_contracts SET
      stage_option_id = COALESCE(${d.stageOptionId || null}::bigint, stage_option_id),
      start_date = COALESCE(${d.startDate || null}::date, start_date),
      end_date = COALESCE(${d.endDate || null}::date, end_date),
      status = COALESCE(${d.status ?? null}, status)
    WHERE id = ${d.contractId}::bigint AND employee_id = ${id}::bigint
    RETURNING id
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  await logAudit({ userId: g.session!.user.id, action: "update", entityType: "employment_contract", entityId: d.contractId });
  return NextResponse.json(jsonSafe(rows[0]));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const contractId = new URL(req.url).searchParams.get("contractId");
  if (!contractId) return NextResponse.json({ error: "contractId wajib" }, { status: 400 });
  const sql = getDb();
  await sql`DELETE FROM employment_contracts WHERE id = ${contractId}::bigint AND employee_id = ${id}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "employment_contract", entityId: contractId });
  return NextResponse.json({ ok: true });
}
