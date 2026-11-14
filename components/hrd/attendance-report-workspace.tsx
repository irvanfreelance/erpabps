"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { btnPrimary } from "@/components/ui/button";

export type AttendanceRecapRow = {
  id: string;
  full_name: string;
  employee_number: string | null;
  days_present: number;
  late_count: number;
  late_minutes: number;
  overtime_count: number;
  overtime_hours: string | number;
  leave_count: number;
};

export type AttendanceRawRow = {
  id: string;
  attendance_date: string;
  employee_id: string;
  full_name: string;
  employee_number: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number;
  payable_minutes: number;
  status: string;
};

function fmtTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttendanceReportWorkspace({
  initialFrom,
  initialTo,
  initialRecap,
  initialRaw,
}: {
  initialFrom: string;
  initialTo: string;
  initialRecap: AttendanceRecapRow[];
  initialRaw: AttendanceRawRow[];
}) {
  const [tab, setTab] = useState<"recap" | "raw">("recap");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [recap, setRecap] = useState<AttendanceRecapRow[]>(initialRecap);
  const [raw, setRaw] = useState<AttendanceRawRow[]>(initialRaw);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  async function applyFilter() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/attendance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          recap: AttendanceRecapRow[];
          raw: AttendanceRawRow[];
        };
        setRecap(data.recap ?? []);
        setRaw(data.raw ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredRaw =
    statusFilter === "all" ? raw : raw.filter((r) => r.status === statusFilter);

  const recapCols: Column<AttendanceRecapRow>[] = [
    { key: "full_name", label: "Nama", hideable: false },
    { key: "employee_number", label: "Nomor" },
    { key: "days_present", label: "Hadir (Hari)", numeric: true },
    { key: "late_count", label: "Count Telat", numeric: true },
    { key: "late_minutes", label: "Menit Telat", numeric: true },
    { key: "overtime_count", label: "Count Lembur", numeric: true },
    { key: "overtime_hours", label: "Jam Lembur", numeric: true },
    { key: "leave_count", label: "Cuti / Izin", numeric: true },
  ];

  const rawCols: Column<AttendanceRawRow>[] = [
    {
      key: "attendance_date",
      label: "Tanggal",
      render: (r) => String(r.attendance_date).slice(0, 10),
    },
    { key: "full_name", label: "Nama", hideable: false },
    { key: "employee_number", label: "Nomor", defaultHidden: true },
    {
      key: "clock_in_at",
      label: "Clock In",
      render: (r) => fmtTime(r.clock_in_at),
    },
    {
      key: "clock_out_at",
      label: "Clock Out",
      render: (r) => fmtTime(r.clock_out_at),
    },
    { key: "late_minutes", label: "Telat (mnt)", numeric: true },
    { key: "payable_minutes", label: "Durasi (mnt)", numeric: true },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("recap")}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === "recap"
                ? "bg-[var(--primary)] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Rekap per Karyawan
          </button>
          <button
            type="button"
            onClick={() => setTab("raw")}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === "raw"
                ? "bg-[var(--primary)] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Data Presensi (Per Baris)
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            Dari
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Sampai
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block h-9 rounded-lg border border-slate-200 px-2.5 text-sm"
            />
          </label>
          {tab === "raw" && (
            <label className="text-xs font-medium text-slate-600">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
              >
                <option value="all">Semua</option>
                <option value="present">present</option>
                <option value="late">late</option>
                <option value="hr_backdate">hr_backdate</option>
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void applyFilter()}
            className={btnPrimary}
          >
            {loading ? "Memuat..." : "Terapkan"}
          </button>
        </div>
      </div>

      {tab === "recap" ? (
        <DataTable
          data={recap}
          columns={recapCols}
          exportFilename={`rekap-kehadiran-${from}-sd-${to}`}
        />
      ) : (
        <DataTable
          data={filteredRaw}
          columns={rawCols}
          exportFilename={`data-presensi-${from}-sd-${to}`}
        />
      )}
    </div>
  );
}

