import { redirect } from "next/navigation";
import { EmployeeProfile } from "@/components/hrd/employee-profile";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { jsonSafe } from "@/lib/utils/serialize";

export const metadata = { title: "Profil karyawan" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  if (session?.user.role === "subordinat" && session.user.employeeId && session.user.employeeId !== id && !session.user.impersonatedBy) {
    redirect(`/employees/${session.user.employeeId}`);
  }

  const sql = getDb();
  const user = session!.user;
  const ids = await visibleEmployeeIds(sql, user);
  const isAdmin = user.role === "superadmin" || Boolean(user.impersonatedBy);
  const ownRow = user.employeeId === id;

  // Single batched query pipeline langsung ke database tanpa 9 HTTP roundtrips
  const [
    employeeRows,
    components,
    educations,
    family,
    contracts,
    allEmployees,
    positions,
    ranks,
    groups,
    locations,
    stages,
    salaryComponents,
    types,
  ] = await Promise.all([
    sql`
      SELECT e.id, e.full_name, e.employee_number, e.record_status, e.in_payroll, e.join_date,
             e.gender, e.marital_status, e.employment_status, e.birth_date, e.address, e.hourly_rate, e.daily_rate,
             e.position_id, e.rank_id, e.location_id, e.pay_group_id, e.supervisor_employee_id,
             e.validation_required, e.employee_type, e.can_clock_outside_radius,
             CASE WHEN ${isAdmin || ownRow || user.role === "superordinat"} THEN e.email ELSE NULL END AS email,
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
      LIMIT 1
    `,
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
    sql`
      SELECT id, full_name FROM employees WHERE deleted_at IS NULL ORDER BY full_name
    `,
    sql`SELECT id, name FROM positions WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT id, name FROM ranks WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT id, name FROM pay_groups WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT id, name FROM locations WHERE deleted_at IS NULL ORDER BY name`,
    sql`SELECT id, name, code FROM contract_stage_options WHERE deleted_at IS NULL ORDER BY sequence_no`,
    sql`SELECT id, name, code FROM salary_components WHERE deleted_at IS NULL ORDER BY code`,
    sql`SELECT id, code, name FROM employee_types WHERE deleted_at IS NULL ORDER BY name`,
  ]);

  if (!employeeRows[0]) {
    redirect("/employees");
  }

  const employee = jsonSafe(employeeRows[0]);
  const safeComponents = jsonSafe(components);
  const safeEducations = jsonSafe(educations);
  const safeFamily = jsonSafe(family);
  const safeContracts = jsonSafe(contracts);

  return (
    <EmployeeProfile
      employee={employee as never}
      components={safeComponents as never[]}
      educations={safeEducations as never[]}
      family={safeFamily as never[]}
      contracts={safeContracts as never[]}
      canEdit={user.role === "superadmin" || user.employeeId === id}
      canEditPay={user.role === "superadmin"}
      catalogs={{
        positions: positions as { id: string; name: string }[],
        ranks: ranks as { id: string; name: string }[],
        payGroups: groups as { id: string; name: string }[],
        locations: locations as { id: string; name: string }[],
        employeeTypes: types.map((t) => ({ value: (t as { code: string }).code, label: (t as { name: string }).name })),
        supervisors: allEmployees.map((r) => ({ id: String((r as { id: string }).id), name: (r as { full_name: string }).full_name })),
        salaryComponents: salaryComponents.map((c) => ({ id: String((c as { id: string }).id), name: `${(c as { code: string }).code} — ${(c as { name: string }).name}` })),
        stages: stages as { id: string; name: string; code: string }[],
      }}
    />
  );
}
