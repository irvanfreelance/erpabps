"use client";

import Link from "next/link";
import { DataTable } from "@/components/data-table/data-table";

type Row = {
  id: string;
  full_name: string;
  employee_number: string | null;
  record_status: string;
  in_payroll: boolean;
  position_name: string | null;
  pay_group_name: string | null;
};

export function EmployeesTable({ rows }: { rows: Row[] }) {
  return (
    <DataTable
      data={rows}
      exportFilename="karyawan"
      columns={[
        { key: "full_name", label: "Nama", render: (r) => <Link href={`/employees/${r.id}`}>{r.full_name}</Link> },
        { key: "employee_number", label: "Nomor" },
        { key: "position_name", label: "Jabatan" },
        { key: "pay_group_name", label: "Kelompok" },
        { key: "record_status", label: "Status" },
        { key: "in_payroll", label: "Payroll", render: (r) => (r.in_payroll ? "ya" : "tidak") },
      ]}
    />
  );
}
