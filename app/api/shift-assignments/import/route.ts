import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { guard } from "@/lib/api/guard";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/db/audit";
import { actorUserId } from "@/lib/hrd/actor";
import { OUTLET_PAY_GROUP, parseScheduleToken } from "@/lib/hrd/schedule";
import { visibleEmployeeIds } from "@/lib/hrd/scope";
import { buildScheduleTemplateWorkbook, cellStr } from "@/lib/utils/schedule-template";

export async function GET(req: Request) {
  const g = await guard("schedules", "create");
  if (g.error) return g.error;
  const month = new URL(req.url).searchParams.get("month") || "2026-11";
  const sql = getDb();
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const [crew, templates] = await Promise.all([
    sql`
      SELECT e.employee_number AS code, e.full_name AS name
      FROM employees e
      JOIN pay_groups g ON g.id = e.pay_group_id AND g.code = ${OUTLET_PAY_GROUP}
      WHERE e.deleted_at IS NULL
        AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
      ORDER BY e.full_name
    `,
    sql`SELECT code, name FROM shift_templates WHERE deleted_at IS NULL ORDER BY code`,
  ]);
  const buf = await buildScheduleTemplateWorkbook({
    month,
    crew: crew as { code: string; name: string }[],
    templates: templates as { code: string; name: string }[],
  });
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-jadwal-outlet-${month}.xlsx"`,
    },
  });
}

export async function POST(req: Request) {
  const g = await guard("schedules", "create");
  if (g.error) return g.error;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Berkas Excel wajib" }, { status: 400 });
  const buf = new Uint8Array(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const sheet = wb.getWorksheet("Jadwal") ?? wb.worksheets[0];
  if (!sheet) return NextResponse.json({ error: "Sheet Jadwal tidak ada" }, { status: 400 });

  const sql = getDb();
  const actor = await actorUserId(sql, g.session!.user);
  if (!actor) return NextResponse.json({ error: "Superadmin belum di-seed" }, { status: 400 });
  const ids = await visibleEmployeeIds(sql, g.session!.user);
  const crew = await sql`
    SELECT e.id, e.full_name
    FROM employees e
    JOIN pay_groups g ON g.id = e.pay_group_id AND g.code = ${OUTLET_PAY_GROUP}
    WHERE e.deleted_at IS NULL
      AND (${ids}::bigint[] IS NULL OR e.id = ANY(${ids}::bigint[]))
  `;
  const byName = new Map((crew as { id: string; full_name: string }[]).map((e) => [e.full_name.trim().toLowerCase(), e]));
  const tpls = await sql`SELECT id, code, shift_kind FROM shift_templates WHERE deleted_at IS NULL`;
  const tplByCode = new Map(
    (tpls as { id: string; code: string; shift_kind: string }[]).map((t) => [t.code.toUpperCase(), t]),
  );

  const headerRow = sheet.getRow(1);
  const dates: { col: number; date: string }[] = [];
  headerRow.eachCell((cell, col) => {
    if (col === 1) return;
    const raw = cellStr(cell.value);
    const iso = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) dates.push({ col, date: iso });
  });
  if (!dates.length) return NextResponse.json({ error: "Header tanggal YYYY-MM-DD tidak ada" }, { status: 400 });

  const errors: { row: number; message: string }[] = [];
  let saved = 0;

  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const name = cellStr(sheet.getRow(r).getCell(1).value);
    if (!name) continue;
    const emp = byName.get(name.trim().toLowerCase());
    if (!emp) {
      errors.push({ row: r, message: `${name} bukan crew outlet` });
      continue;
    }
    for (const d of dates) {
      const token = cellStr(sheet.getRow(r).getCell(d.col).value);
      if (!token) continue;
      const parsed = parseScheduleToken(token);
      if (!parsed?.code) {
        errors.push({ row: r, message: `Nilai tidak dikenali di ${d.date}: ${token}` });
        continue;
      }
      const tpl = tplByCode.get(parsed.code);
      if (!tpl) {
        errors.push({ row: r, message: `Template ${parsed.code} tidak ada` });
        continue;
      }
      await sql`
        INSERT INTO shift_assignments (
          employee_id, shift_template_id, work_date, day_status, is_backup,
          start_time, end_time, assigned_by, notes
        ) VALUES (
          ${emp.id}::bigint, ${tpl.id}::bigint, ${d.date}::date, ${parsed.dayStatus},
          ${tpl.shift_kind === "backup"},
          ${parsed.startTime ?? null}::time, ${parsed.endTime ?? null}::time,
          ${actor}::bigint, ${parsed.notes ?? null}
        )
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
          shift_template_id = EXCLUDED.shift_template_id,
          day_status = EXCLUDED.day_status,
          is_backup = EXCLUDED.is_backup,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          notes = EXCLUDED.notes,
          updated_at = now()
      `;
      saved += 1;
    }
  }
  await logAudit({
    userId: g.session!.user.id,
    action: "create",
    entityType: "shift_assignment_import",
    valueAfter: { saved, rejected: errors.length },
  });
  return NextResponse.json({ saved, errors });
}
