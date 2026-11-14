"use client";

import { DataTable } from "@/components/data-table/data-table";
import { ScreenActions } from "@/components/hrd/screen-actions";

type Row = { id: string; full_name: string; amount: string; screening_status: string };

export function ScreeningTable({ rows }: { rows: Row[] }) {
  return (
    <DataTable
      data={rows}
      columns={[
        { key: "full_name", label: "Nama" },
        { key: "amount", label: "Nominal", money: true },
        { key: "screening_status", label: "Status" },
        {
          key: "id",
          label: "Aksi",
          render: (r) =>
            r.screening_status === "submitted" || r.screening_status === "pending" ? (
              <ScreenActions id={String(r.id)} />
            ) : (
              <span className="text-xs text-gray-400">Selesai ({r.screening_status})</span>
            ),
        },
      ]}
    />
  );
}
