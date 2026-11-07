"use client";

import Link from "next/link";
import { DataTable } from "@/components/data-table/data-table";

export type LocationRow = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  radius_meter: number;
};

function toNum(v: string | number | null | undefined) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function LocationsWorkspace({ rows }: { rows: LocationRow[] }) {
  return (
    <div>
      <DataTable
        data={rows}
        columns={[
          { key: "code", label: "Kode" },
          { key: "name", label: "Nama" },
          { key: "radius_meter", label: "Radius (m)", numeric: true },
          {
            key: "latitude",
            label: "Koordinat",
            render: (row) => (toNum(row.latitude) != null && toNum(row.longitude) != null ? "Ada" : "Kosong"),
          },
          {
            key: "id",
            label: "",
            render: (row) => (
              <Link href={`/master/locations/${row.id}`} className="text-[13px] font-semibold text-[var(--primary)]">
                Ubah
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
