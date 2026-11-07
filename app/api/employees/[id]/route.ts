import { NextResponse } from "next/server";
import { guard, isDuplicateEmailError, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { allocateEmployeeNumber } from "@/lib/hrd/employee-number";
import { ensureEmployeeUser } from "@/lib/hrd/employee-user";
import { canMutateEmployee, visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";
import { employeePatchSchema } from "@/lib/validators/employee";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "read");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const isAdmin = g.session!.user.role === "superadmin";
  const ownRow = g.session!.user.employeeId === id;
  const rows = await sql`
    SELECT e.id, e.full_name, e.employee_number, e.record_status, e.in_payroll, e.join_date,
           e.gender, e.marital_status, e.employment_status, e.birth_date, e.address, e.hourly_rate, e.daily_rate,
           e.position_id, e.rank_id, e.location_id, e.pay_group_id, e.supervisor_employee_id,
           e.validation_required,
           CASE WHEN ${isAdmin || ownRow || g.session!.user.role === "superordinat"} THEN e.email ELSE NULL END AS email,
           CASE WHEN ${isAdmin || ownRow} THEN e.phone ELSE NULL END AS phone,
           CASE WHEN ${isAdmin} THEN e.nik ELSE NULL END AS nik,
           CASE WHEN ${isAdmin} THEN e.npwp ELSE NULL END AS npwp,
           CASE WHEN ${isAdmin} THEN e.bpjs_kesehatan_id ELSE NULL END AS bpjs_kesehatan_id,
           CASE WHEN ${isAdmin} THEN e.bpjs_tk_id ELSE NULL END AS bpjs_tk_id,
           CASE WHEN ${isAdmin} THEN e.tax_status ELSE NULL END AS tax_status,
           CASE WHEN ${isAdmin} THEN e.ktp_image_url ELSE NULL END AS ktp_image_url,
           CASE WHEN ${isAdmin} THEN e.bank_name ELSE NULL END AS bank_name,
           CASE WHEN ${isAdmin} THEN e.bank_account_number ELSE NULL END AS bank_account_number,
           CASE WHEN ${isAdmin} THEN e.bank_account_name ELSE NULL END AS bank_account_name,
           p.name AS position_name, rk.name AS rank_name, l.name AS location_name,
           g.name AS pay_group_name, s.full_name AS supervisor_name,
           CASE WHEN e.join_date IS NULL THEN NULL ELSE (CURRENT_DATE - e.join_date) END AS tenure_days
    FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN ranks rk ON rk.id = e.rank_id
    LEFT JOIN locations l ON l.id = e.location_id
    LEFT JOIN pay_groups g ON g.id = e.pay_group_id
    LEFT JOIN employees s ON s.id = e.supervisor_employee_id
    WHERE e.id = ${id}::bigint AND e.deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
  `;
  if (!rows[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  const [components, educations, family, contracts] = await Promise.all([
    sql`
      SELECT esc.id, sc.code, sc.name, sc.component_type, esc.amount, esc.effective_from, esc.effective_until, esc.salary_component_id
      FROM employee_salary_components esc
      JOIN salary_components sc ON sc.id = esc.salary_component_id
      WHERE esc.employee_id = ${id}::bigint
      ORDER BY esc.effective_from DESC
    `,
    sql`
      SELECT id, level, institution, major, start_year, end_year
      FROM employee_educations WHERE employee_id = ${id}::bigint ORDER BY start_year DESC NULLS LAST, id
    `,
    sql`
      SELECT id, relation, full_name, birth_date
      FROM employee_family_members WHERE employee_id = ${id}::bigint ORDER BY id
    `,
    sql`
      SELECT c.id, c.sequence_no, c.start_date, c.end_date, c.status, c.stage_option_id, s.code AS stage_code, s.name AS stage_name, s.duration_months
      FROM employment_contracts c
      JOIN contract_stage_options s ON s.id = c.stage_option_id
      WHERE c.employee_id = ${id}::bigint
      ORDER BY c.sequence_no
    `,
  ]);
  return NextResponse.json(
    jsonSafe({ employee: rows[0], components, educations, family, contracts }),
  );
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const parsed = employeePatchSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  if (d.supervisorEmployeeId && d.supervisorEmployeeId === id) {
    return NextResponse.json({ error: "Atasan tidak boleh diri sendiri" }, { status: 400 });
  }
  const sql = getDb();
  if (!(await canMutateEmployee(sql, g.session!.user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const current = await sql`
    SELECT employee_number, position_id, pay_group_id, join_date, record_status
    FROM employees WHERE id = ${id}::bigint AND deleted_at IS NULL
  `;
  if (!current[0]) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  const cur = current[0] as {
    employee_number: string | null;
    position_id: string | null;
    pay_group_id: string | null;
    join_date: string | null;
    record_status: string;
  };
  const own = g.session!.user.role !== "superadmin";
  const nextStatus = own ? cur.record_status : (d.recordStatus ?? cur.record_status);
  const nextJoin = own ? cur.join_date : d.joinDate !== undefined ? d.joinDate : cur.join_date;
  let nextNum = cur.employee_number;
  if (!own && d.employeeNumber) nextNum = d.employeeNumber;
  if (!nextNum) nextNum = await allocateEmployeeNumber(sql, null);
  const nextPos = own ? cur.position_id : d.positionId !== undefined ? d.positionId : cur.position_id;
  const nextGroup = own ? cur.pay_group_id : d.payGroupId !== undefined ? d.payGroupId : cur.pay_group_id;
  if (nextStatus === "active" && !(nextJoin && nextNum && nextPos && nextGroup)) {
    return NextResponse.json(
      { error: "Karyawan aktif wajib jabatan, kelompok gaji, dan tanggal bergabung" },
      { status: 400 },
    );
  }
  const admin = g.session!.user.role === "superadmin";
  const nik = admin ? (d.nik === "" ? null : d.nik ?? undefined) : undefined;
  const touchSupervisor = !own && Object.prototype.hasOwnProperty.call(d, "supervisorEmployeeId");
  const supervisorVal = d.supervisorEmployeeId || null;
  const touchOrg = !own;
  try {
  const rows = await sql`
    UPDATE employees SET
      full_name = COALESCE(${d.fullName ?? null}, full_name),
      employee_number = COALESCE(${nextNum}, employee_number),
      gender = COALESCE(${d.gender ?? null}, gender),
      marital_status = CASE WHEN ${d.maritalStatus !== undefined} THEN ${d.maritalStatus || null} ELSE marital_status END,
      employment_status = COALESCE(${d.employmentStatus ?? null}, employment_status),
      birth_date = COALESCE(${d.birthDate || null}::date, birth_date),
      address = CASE WHEN ${d.address !== undefined} THEN ${d.address || null} ELSE address END,
      join_date = CASE WHEN ${touchOrg} THEN COALESCE(${d.joinDate || null}::date, join_date) ELSE join_date END,
      location_id = CASE WHEN ${touchOrg} THEN COALESCE(${d.locationId || null}::bigint, location_id) ELSE location_id END,
      position_id = CASE WHEN ${touchOrg} THEN COALESCE(${d.positionId || null}::bigint, position_id) ELSE position_id END,
      rank_id = CASE WHEN ${touchOrg} THEN COALESCE(${d.rankId || null}::bigint, rank_id) ELSE rank_id END,
      pay_group_id = CASE WHEN ${touchOrg} THEN COALESCE(${d.payGroupId || null}::bigint, pay_group_id) ELSE pay_group_id END,
      supervisor_employee_id = CASE WHEN ${touchSupervisor} THEN ${supervisorVal}::bigint ELSE supervisor_employee_id END,
      record_status = ${nextStatus},
      in_payroll = CASE WHEN ${nextStatus} = 'active' THEN COALESCE(${d.inPayroll ?? null}, in_payroll) ELSE FALSE END,
      hourly_rate = CASE WHEN ${touchOrg} THEN COALESCE(${d.hourlyRate ?? null}, hourly_rate) ELSE hourly_rate END,
      daily_rate = CASE WHEN ${touchOrg} THEN COALESCE(${d.dailyRate ?? null}, daily_rate) ELSE daily_rate END,
      email = CASE WHEN ${d.email !== undefined} THEN ${d.email} ELSE email END,
      phone = CASE WHEN ${admin || own} THEN COALESCE(${d.phone ?? null}, phone) ELSE phone END,
      nik = CASE WHEN ${admin} AND ${nik !== undefined} THEN ${nik ?? null} ELSE nik END,
      npwp = CASE WHEN ${admin} THEN COALESCE(${d.npwp ?? null}, npwp) ELSE npwp END,
      bpjs_kesehatan_id = CASE WHEN ${admin} THEN COALESCE(${d.bpjsKesehatanId ?? null}, bpjs_kesehatan_id) ELSE bpjs_kesehatan_id END,
      bpjs_tk_id = CASE WHEN ${admin} THEN COALESCE(${d.bpjsTkId ?? null}, bpjs_tk_id) ELSE bpjs_tk_id END,
      tax_status = CASE WHEN ${admin} THEN COALESCE(${d.taxStatus ?? null}, tax_status) ELSE tax_status END,
      bank_name = CASE WHEN ${admin} THEN COALESCE(${d.bankName ?? null}, bank_name) ELSE bank_name END,
      bank_account_number = CASE WHEN ${admin} THEN COALESCE(${d.bankAccountNumber ?? null}, bank_account_number) ELSE bank_account_number END,
      bank_account_name = CASE WHEN ${admin} THEN COALESCE(${d.bankAccountName ?? null}, bank_account_name) ELSE bank_account_name END,
      updated_at = now()
    WHERE id = ${id}::bigint AND deleted_at IS NULL
    RETURNING id, full_name, record_status, in_payroll
  `;
  await ensureEmployeeUser(sql, id);
  await logAudit({
    userId: g.session!.user.id,
    action: "update",
    entityType: "employee",
    entityId: id,
    valueAfter: { fullName: d.fullName, recordStatus: nextStatus },
  });
  return NextResponse.json(jsonSafe(rows[0]));
  } catch (err) {
    if (isDuplicateEmailError(err)) {
      return NextResponse.json({ error: "Email sudah dipakai" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard("employees", "update");
  if (g.error) return g.error;
  if (g.session!.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const sql = getDb();
  await sql`UPDATE employees SET deleted_at = now(), is_active = FALSE, in_payroll = FALSE, updated_at = now() WHERE id = ${id}::bigint`;
  await logAudit({ userId: g.session!.user.id, action: "delete", entityType: "employee", entityId: id });
  return NextResponse.json({ ok: true });
}
