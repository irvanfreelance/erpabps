"use client";

import { DataTable, type Column } from "@/components/data-table/data-table";

export function EntityPage<T extends { id?: string | number }>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: Column<T>[];
}) {
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[20px]">
        {title} ({rows.length})
      </h1>
      <DataTable data={rows} columns={columns} exportFilename={title} />
    </div>
  );
}
