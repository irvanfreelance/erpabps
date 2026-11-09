"use client";

import { DataTable, type Column } from "@/components/data-table/data-table";

export function StockTablePage<T extends { id?: string | number }>({
  title,
  subtitle,
  rows,
  columns,
}: {
  title: string;
  subtitle?: string;
  rows: T[];
  columns: Column<T>[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 mt-0 text-[18px] font-bold text-[var(--primary)] md:text-[22px]">
          {title} ({rows.length})
        </h1>
        {subtitle && <p className="text-xs text-gray-500 m-0">{subtitle}</p>}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-5 shadow-xs">
        <DataTable data={rows} columns={columns} exportFilename={title} />
      </div>
    </div>
  );
}

