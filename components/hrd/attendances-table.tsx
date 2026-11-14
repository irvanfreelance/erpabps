"use client";

import { useMemo, useState } from "react";
import { Download, Filter, RotateCcw, Search, Upload } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { downloadXlsx } from "@/lib/utils/export-xlsx";
import { btnPrimary, btnSecondary } from "@/components/ui/button";
import { FingerprintImportModal } from "@/components/hrd/fingerprint-import-modal";

export type AttendanceItem = {
  id: string;
  employee_id: string;
  full_name: string;
  employee_number: string | null;
  employee_type: string | null;
  attendance_date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: string;
  late_minutes: number;
  payable_minutes: number;
  clock_in_status: string;
  outside_radius_note: string | null;
  late_reason: string | null;
  backdate_reason: string | null;
  location_name: string | null;
  shift_code: string | null;
  shift_name: string | null;
};

export function AttendancesTable({
  initialRows,
  locations = [],
  employeeTypes = [],
  isSuperadmin = false,
}: {
  initialRows: AttendanceItem[];
  locations?: { id: string; name: string }[];
  employeeTypes?: { code: string; name: string }[];
  isSuperadmin?: boolean;
}) {
  // Advanced Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterRadiusStatus, setFilterRadiusStatus] = useState("");
  const [filterLate, setFilterLate] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [openFingerprintModal, setOpenFingerprintModal] = useState(false);

  // Client-side filtering across fields
  const filteredData = useMemo(() => {
    return initialRows.filter((row) => {
      // 1. Search term (Nama, NIK, Keterangan)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = row.full_name?.toLowerCase().includes(q);
        const matchNik = row.employee_number?.toLowerCase().includes(q);
        const matchNote = row.outside_radius_note?.toLowerCase().includes(q);
        const matchLateReason = row.late_reason?.toLowerCase().includes(q);
        const matchLoc = row.location_name?.toLowerCase().includes(q);
        if (!matchName && !matchNik && !matchNote && !matchLateReason && !matchLoc) {
          return false;
        }
      }

      // 2. Date Range
      if (filterStartDate && row.attendance_date < filterStartDate) return false;
      if (filterEndDate && row.attendance_date > filterEndDate) return false;

      // 3. Employee Type
      if (filterType && row.employee_type !== filterType) return false;

      // 4. Location Name
      if (filterLocation && row.location_name !== filterLocation) return false;

      // 5. Status Radius
      if (filterRadiusStatus && row.clock_in_status !== filterRadiusStatus) return false;

      // 6. Terlambat
      if (filterLate === "late" && Number(row.late_minutes || 0) <= 0) return false;
      if (filterLate === "on_time" && Number(row.late_minutes || 0) > 0) return false;

      return true;
    });
  }, [
    initialRows,
    searchTerm,
    filterStartDate,
    filterEndDate,
    filterType,
    filterLocation,
    filterRadiusStatus,
    filterLate,
  ]);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterType("");
    setFilterLocation("");
    setFilterRadiusStatus("");
    setFilterLate("");
  };

  const columns: Column<AttendanceItem>[] = [
    {
      key: "attendance_date",
      label: "Tanggal",
      width: "110px",
    },
    {
      key: "full_name",
      label: "Nama Karyawan",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">{r.full_name}</div>
          <div className="text-[11px] text-gray-400">
            {r.employee_number || "-"} · {r.employee_type ? r.employee_type.toUpperCase() : "OUTLET"}
          </div>
        </div>
      ),
    },
    {
      key: "location_name",
      label: "Lokasi",
      render: (r) => r.location_name || "-",
    },
    {
      key: "shift",
      label: "Jadwal/Shift",
      render: (r) => r.shift_name || r.shift_code || (r.employee_type === "dapur" ? "Dapur (Jam)" : "Office"),
    },
    {
      key: "clock_in_time",
      label: "Jam Masuk",
      render: (r) => (
        <span className="font-medium text-emerald-700">
          {r.clock_in_time ? r.clock_in_time.slice(0, 5) : "-"}
        </span>
      ),
    },
    {
      key: "clock_out_time",
      label: "Jam Keluar",
      render: (r) => (
        <span className="font-medium text-blue-700">
          {r.clock_out_time ? r.clock_out_time.slice(0, 5) : "-"}
        </span>
      ),
    },
    {
      key: "late_minutes",
      label: "Keterlambatan",
      numeric: true,
      render: (r) => (
        <div>
          {r.late_minutes > 0 ? (
            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[12px] font-bold text-red-700">
              {r.late_minutes} mnt
            </span>
          ) : (
            <span className="text-[12px] text-gray-400">Tepat Waktu</span>
          )}
          {r.late_reason && (
            <div className="text-[11px] text-gray-500 italic max-w-xs truncate" title={r.late_reason}>
              Alasan: {r.late_reason}
            </div>
          )}
        </div>
      ),
      exportValue: (r) => `${r.late_minutes} menit${r.late_reason ? ` (${r.late_reason})` : ""}`,
    },
    {
      key: "clock_in_status",
      label: "Status Radius",
      render: (r) => (
        <div>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              r.clock_in_status === "valid"
                ? "bg-emerald-100 text-emerald-800"
                : r.clock_in_status === "outside_radius"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-800"
            }`}
          >
            {r.clock_in_status === "valid"
              ? "Dalam Radius"
              : r.clock_in_status === "outside_radius"
                ? "Luar Radius"
                : r.clock_in_status}
          </span>
          {r.outside_radius_note && (
            <div className="text-[11px] text-gray-500 italic max-w-xs truncate" title={r.outside_radius_note}>
              Ket: {r.outside_radius_note}
            </div>
          )}
        </div>
      ),
      exportValue: (r) =>
        r.clock_in_status === "valid"
          ? "Dalam Radius"
          : `${r.clock_in_status}${r.outside_radius_note ? ` (${r.outside_radius_note})` : ""}`,
    },
  ];

  const handleExportExcel = async () => {
    await downloadXlsx({
      filename: `Rekap_Kehadiran_${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Kehadiran",
      columns: [
        { key: "attendance_date", label: "Tanggal" },
        { key: "full_name", label: "Nama Karyawan" },
        { key: "employee_number", label: "NIK / No. Karyawan" },
        { key: "employee_type", label: "Jenis Karyawan", exportValue: (r) => r.employee_type?.toUpperCase() || "OUTLET" },
        { key: "location_name", label: "Lokasi" },
        { key: "clock_in_time", label: "Masuk (WIB)" },
        { key: "clock_out_time", label: "Keluar (WIB)" },
        { key: "late_minutes", label: "Keterlambatan (Menit)" },
        { key: "late_reason", label: "Alasan Telat" },
        { key: "clock_in_status", label: "Status Kehadiran" },
        { key: "outside_radius_note", label: "Alasan Luar Radius" },
      ],
      rows: filteredData,
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, nomor karyawan, atau catatan alasan..."
            className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-[13px] focus:border-[var(--primary)] focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {isSuperadmin && (
            <button
              type="button"
              onClick={() => setOpenFingerprintModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-white px-3 py-2 text-[13px] font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 transition-all"
            >
              <Upload className="h-4 w-4" />
              <span>Import Fingerprint</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`${btnSecondary} flex items-center gap-1.5`}
          >
            <Filter className="h-4 w-4" />
            <span>Filter Lanjutan</span>
            {(filterStartDate || filterEndDate || filterType || filterLocation || filterRadiusStatus || filterLate) && (
              <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
            )}
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className={`${btnPrimary} flex items-center gap-1.5`}
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showAdvanced && (
        <div className="rounded-2xl border border-gray-200 bg-[#fbfdfd] p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Dari Tanggal</label>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-300 p-2 text-[12px] bg-white focus:outline-none"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                className="w-full rounded-xl border border-gray-300 p-2 text-[12px] bg-white focus:outline-none"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Jenis Karyawan</label>
              <select
                className="w-full rounded-xl border border-gray-300 p-2 text-[12px] bg-white focus:outline-none"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Semua Jenis</option>
                {employeeTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Lokasi</label>
              <select
                className="w-full rounded-xl border border-gray-300 p-2 text-[12px] bg-white focus:outline-none"
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
              >
                <option value="">Semua Lokasi</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Radius Presensi</label>
              <select
                className="w-full rounded-xl border border-gray-300 p-2 text-[12px] bg-white focus:outline-none"
                value={filterRadiusStatus}
                onChange={(e) => setFilterRadiusStatus(e.target.value)}
              >
                <option value="">Semua Status Radius</option>
                <option value="valid">Di Dalam Radius</option>
                <option value="outside_radius">Di Luar Radius</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Status Keterlambatan</label>
              <select
                className="w-full rounded-xl border border-gray-300 p-2 text-[12px] bg-white focus:outline-none"
                value={filterLate}
                onChange={(e) => setFilterLate(e.target.value)}
              >
                <option value="">Semua</option>
                <option value="late">Hanya yang Terlambat</option>
                <option value="on_time">Tepat Waktu</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-end justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="text-[12px] text-gray-600 hover:text-red-600 flex items-center gap-1 py-2 px-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Semua Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Table with Pagination */}
      <DataTable
        data={filteredData}
        columns={columns}
        exportFilename={`Rekap_Kehadiran_${new Date().toISOString().slice(0, 10)}`}
      />

      {/* Modal Import Fingerprint */}
      <FingerprintImportModal
        open={openFingerprintModal}
        onClose={() => setOpenFingerprintModal(false)}
      />
    </div>
  );
}
