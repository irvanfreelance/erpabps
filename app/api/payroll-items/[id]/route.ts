import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { ownEmployeeId } from "@/lib/hrd/scope";
import { logAudit } from "@/lib/db/audit";
import { jsonSafe } from "@/lib/utils/serialize";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("payslips", "read");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  const user = g.session!.user;

  const itemRows = await sql`
    SELECT i.*, e.full_name, e.employee_number,
           p.name AS position_name, l.name AS location_name,
           r.period_start, r.period_end, r.status AS run_status, r.pay_frequency,
           g.name AS pay_group_name
    FROM payroll_items i
    JOIN employees e ON e.id = i.employee_id
    JOIN payroll_runs r ON r.id = i.payroll_run_id
    JOIN pay_groups g ON g.id = r.pay_group_id
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN locations l ON l.id = e.location_id
    WHERE i.id = ${id}::bigint
    LIMIT 1
  `;
  const item = itemRows[0] as Record<string, unknown> | undefined;
  if (!item) return NextResponse.json({ error: "Slip gaji tidak ditemukan" }, { status: 404 });

  // Proteksi: Subordinat & Superordinat hanya bisa melihat slip miliknya sendiri
  if (user.role !== "superadmin") {
    const myId = user.employeeId ?? (await ownEmployeeId(sql, user));
    if (!myId || String(item.employee_id) !== String(myId)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }
  }

  const details = await sql`
    SELECT id, component_code, quantity, unit_rate, amount, source_ref
    FROM payroll_item_details
    WHERE payroll_item_id = ${id}::bigint
    ORDER BY id
  `;

  const org = (await sql`SELECT nama, nama_singkat, tagline FROM org_profile LIMIT 1`)[0] ?? {};

  return NextResponse.json(jsonSafe({ item, details, org }));
}

// Endpoint untuk Superadmin HR meng-override detail payroll item (komponen gaji / potongan) sebelum run disetujui
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("payroll-runs", "update");
  if (g.error) return g.error;
  if (g.session!.user.role !== "superadmin") {
    return NextResponse.json({ error: "Hanya Superadmin HR yang dapat meng-override komponen payroll" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const sql = getDb();
  const body = await req.json();

  const itemRows = await sql`
    SELECT i.id, i.payroll_run_id, r.status
    FROM payroll_items i
    JOIN payroll_runs r ON r.id = i.payroll_run_id
    WHERE i.id = ${id}::bigint
  `;
  const item = itemRows[0] as { id: string; payroll_run_id: string; status: string } | undefined;
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
  if (item.status === "approved" || item.status === "paid") {
    return NextResponse.json({ error: "Payroll run sudah disetujui / dibekukan" }, { status: 400 });
  }

  // Operasi: tambah/update komponen detail atau update nominal langsung
  // body format: { action: 'upsert_detail', componentCode: string, amount: number, quantity?: number, unitRate?: number }
  // atau { action: 'delete_detail', detailId: string }
  if (body.action === "upsert_detail") {
    const code = String(body.componentCode ?? "").trim();
    const amount = Number(body.amount ?? 0);
    const qty = Number(body.quantity ?? 1);
    const rate = Number(body.unitRate ?? amount);
    if (!code) return NextResponse.json({ error: "Kode komponen wajib diisi" }, { status: 400 });

    const existing = await sql`
      SELECT id FROM payroll_item_details
      WHERE payroll_item_id = ${id}::bigint AND component_code = ${code}
      LIMIT 1
    `;
    if (existing[0]) {
      await sql`
        UPDATE payroll_item_details
        SET amount = ${amount}, quantity = ${qty}, unit_rate = ${rate}, source_ref = 'manual_override'
        WHERE id = ${existing[0].id}::bigint
      `;
    } else {
      await sql`
        INSERT INTO payroll_item_details (payroll_item_id, component_code, quantity, unit_rate, amount, source_ref)
        VALUES (${id}::bigint, ${code}, ${qty}, ${rate}, ${amount}, 'manual_override')
      `;
    }
  } else if (body.action === "delete_detail") {
    const detailId = String(body.detailId);
    await sql`DELETE FROM payroll_item_details WHERE id = ${detailId}::bigint AND payroll_item_id = ${id}::bigint`;
  }

  // Rekalkulasi total earnings, deduction, dan net_pay pada payroll_items
  const allDetails = (await sql`
    SELECT component_code, amount FROM payroll_item_details WHERE payroll_item_id = ${id}::bigint
  `) as { component_code: string; amount: string }[];

  let newEarnings = 0;
  let newDeductions = 0;
  for (const d of allDetails) {
    const val = Number(d.amount);
    if (val >= 0) {
      newEarnings += val;
    } else {
      newDeductions += Math.abs(val);
    }
  }
  const newNet = newEarnings - newDeductions;

  await sql`
    UPDATE payroll_items
    SET earnings_total = ${newEarnings}, deduction_total = ${newDeductions}, net_pay = ${newNet}
    WHERE id = ${id}::bigint
  `;

  await logAudit({
    userId: g.session!.user.id,
    action: "override_payroll_item",
    entityType: "payroll_item",
    entityId: id,
    valueAfter: body,
  });

  return NextResponse.json({ success: true, earnings: newEarnings, deductions: newDeductions, netPay: newNet });
}
