import type { SqlClient } from "@/lib/db";

/** Nomor mengikuti roster: CW + 3 digit (CW011, CW012, …). */
export async function allocateEmployeeNumber(sql: SqlClient, requested?: string | null) {
  const given = requested?.trim();
  if (given) return given;
  const rows = await sql`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(employee_number FROM 3) AS INT)),
      0
    ) + 1 AS n
    FROM employees
    WHERE employee_number ~ '^CW[0-9]{3}$'
  `;
  let n = Number((rows[0] as { n: number | string } | undefined)?.n ?? 1);
  for (let i = 0; i < 50; i += 1) {
    const code = `CW${String(n).padStart(3, "0")}`;
    const clash = await sql`SELECT 1 FROM employees WHERE employee_number = ${code} LIMIT 1`;
    if (!clash[0]) return code;
    n += 1;
  }
  throw new Error("Nomor karyawan otomatis habis");
}
