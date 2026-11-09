import { NextResponse } from "next/server";
import { guard, isDuplicateEmailError, zodError } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { allocateEmployeeNumber } from "@/lib/hrd/employee-number";
import { ensureEmployeeUser } from "@/lib/hrd/employee-user";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";
import { employeeWriteSchema } from "@/lib/validators/employee";

function canActivate(d: {
  joinDate?: string | null;
  employeeNumber?: string | null;
  positionId?: string | null;
  payGroupId?: string | null;
}) {
  return Boolean(d.joinDate && d.employeeNumber && d.positionId && d.payGroupId);
}

export async function GET() {
  const g = await guard("employees", "read");
  if (g.error) return g.error;
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const remind = await sql`
    SELECT v.value
    FROM setting_values v
    JOIN setting_definitions d ON d.id = v.definition_id
    WHERE d.key = 'contract.remind_days' AND v.status = 'active' AND v.scope_type = 'org'
    ORDER BY v.effective_from DESC
    LIMIT 1
  `;
  const raw = (remind[0] as { value: { v?: unknown } } | undefined)?.value;
  const remindDays = typeof raw?.v === "number" ? raw.v : 30;

  const rows = await sql`
    SELECT e.id, e.full_name, e.employee_number, e.record_status, e.in_payroll,
           e.employment_status, e.gender, e.employee_type, e.can_clock_outside_radius,
           to_char(e.join_date, 'YYYY-MM-DD') AS join_date,
           p.name AS position_name, rk.name AS rank_name, l.name AS location_name,
           g.name AS pay_group_name, s.full_name AS supervisor_name,
           st.name AS contract_stage,
           to_char(c.start_date, 'YYYY-MM-DD') AS contract_start,
           to_char(c.end_date, 'YYYY-MM-DD') AS contract_end,
           CASE WHEN e.join_date IS NULL THEN NULL
                ELSE (CURRENT_DATE - e.join_date) END AS tenure_days,
           CASE
             WHEN ${remindDays}::int IS NULL OR c.end_date IS NULL THEN FALSE
             ELSE (c.end_date - CURRENT_DATE) BETWEEN 0 AND ${remindDays}::int
           END AS ending_soon
    FROM employees e
    LEFT JOIN positions p ON p.id = e.position_id
    LEFT JOIN ranks rk ON rk.id = e.rank_id AND rk.deleted_at IS NULL
    LEFT JOIN locations l ON l.id = e.location_id
    LEFT JOIN pay_groups g ON g.id = e.pay_group_id
    LEFT JOIN employees s ON s.id = e.supervisor_employee_id AND s.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT ec.start_date, ec.end_date, ec.stage_option_id
      FROM employment_contracts ec
      WHERE ec.employee_id = e.id AND ec.status = 'active'
      ORDER BY ec.sequence_no DESC
      LIMIT 1
    ) c ON TRUE
    LEFT JOIN contract_stage_options st ON st.id = c.stage_option_id
    WHERE e.deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
    ORDER BY e.full_name
  `;
  return NextResponse.json(jsonSafe({ rows, remindDays }));
}

export async function POST(req: Request) {
  const g = await guard("employees", "create");
  if (g.error) return g.error;
  const parsed = employeeWriteSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;
  const joinDate = d.joinDate || null;
  const status = d.recordStatus ?? "draft";
  const sql = getDb();
  const employeeNumber = await allocateEmployeeNumber(sql, d.employeeNumber);
  if (status === "active" && !canActivate({ ...d, joinDate, employeeNumber })) {
    return NextResponse.json(
      { error: "Karyawan aktif wajib jabatan, kelompok gaji, dan tanggal bergabung" },
      { status: 400 },
    );
  }
  const nik = g.session!.user.role === "superadmin" && d.nik ? d.nik : null;
  try {
  const rows = await sql`
    INSERT INTO employees (
      full_name, employee_number, gender, marital_status, birth_date, address, join_date,
      location_id, position_id, rank_id, pay_group_id, supervisor_employee_id,
      employment_status, record_status, in_payroll, validation_required, has_login,
      hourly_rate, daily_rate, email, phone, nik, npwp, bpjs_kesehatan_id, bpjs_tk_id, tax_status,
      bank_name, bank_account_number, bank_account_name, employee_type, can_clock_outside_radius
    ) VALUES (
      ${d.fullName},
      ${employeeNumber},
      ${d.gender ?? null},
      ${d.maritalStatus ?? null},
      ${d.birthDate || null}::date,
      ${d.address || null},
      ${joinDate}::date,
      ${d.locationId || null}::bigint,
      ${d.positionId || null}::bigint,
      ${d.rankId || null}::bigint,
      ${d.payGroupId || null}::bigint,
      ${d.supervisorEmployeeId || null}::bigint,
      ${d.employmentStatus ?? "contract"},
      ${status},
      ${Boolean(d.inPayroll) && status === "active"},
      TRUE,
      FALSE,
      ${d.hourlyRate ?? null},
      ${d.dailyRate ?? null},
      ${d.email},
      ${g.session!.user.role === "superadmin" ? d.phone || null : null},
      ${nik},
      ${g.session!.user.role === "superadmin" ? d.npwp || null : null},
      ${g.session!.user.role === "superadmin" ? d.bpjsKesehatanId || null : null},
      ${g.session!.user.role === "superadmin" ? d.bpjsTkId || null : null},
      ${g.session!.user.role === "superadmin" ? d.taxStatus || null : null},
      ${g.session!.user.role === "superadmin" ? d.bankName || null : null},
      ${g.session!.user.role === "superadmin" ? d.bankAccountNumber || null : null},
      ${g.session!.user.role === "superadmin" ? d.bankAccountName || null : null},
      ${d.employeeType ?? "outlet"},
      ${Boolean(d.canClockOutsideRadius)}
    )
    RETURNING id, full_name, employee_number, record_status, in_payroll, employee_type, can_clock_outside_radius
  `;
  const createdId = String((rows[0] as { id: string }).id);
  await ensureEmployeeUser(sql, createdId);
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "employee",
    entityId: createdId,
    valueAfter: { fullName: d.fullName, recordStatus: status },
  });
  return NextResponse.json(jsonSafe(rows[0]));
  } catch (err) {
    if (isDuplicateEmailError(err)) {
      return NextResponse.json({ error: "Email sudah dipakai" }, { status: 400 });
    }
    throw err;
  }
}
