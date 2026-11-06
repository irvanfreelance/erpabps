"use client";

import Link from "next/link";
import { DataTable } from "@/components/data-table/data-table";

type Row = { id: string; pay_group_name: string; period_start: string; period_end: string; status: string };

export function RunsTable({ rows }: { rows: Row[] }) {
  return (
    <DataTable
      data={rows}
      columns={[
        { key: "pay_group_name", label: "Kelompok", render: (r) => <Link href={`/payroll-runs/${r.id}`}>{r.pay_group_name}</Link> },
        { key: "period_start", label: "Mulai" },
        { key: "period_end", label: "Akhir" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
