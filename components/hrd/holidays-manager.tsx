"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Trash2, Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { btnPrimary } from "@/components/ui/button";

export type HolidayRow = {
  id: string;
  holiday_date: string;
  name: string;
  is_sunday: boolean;
};

export function HolidaysManager({
  rows = [],
  canManage = false,
}: {
  rows: HolidayRow[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [holidayDate, setHolidayDate] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!holidayDate) {
      toast.error("Pilih tanggal hari libur");
      return;
    }
    if (!name.trim()) {
      toast.error("Nama hari libur wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holidayDate, name }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Gagal menyimpan hari libur");
        return;
      }

      toast.success("Hari libur berhasil disimpan!");
      setHolidayDate("");
      setName("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Hapus tanggal merah '${label}'?`)) return;

    setDeletingId(id);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });

      if (!res.ok) {
        toast.error("Gagal menghapus hari libur");
        return;
      }

      toast.success("Hari libur berhasil dihapus");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Column<HolidayRow>[] = [
    {
      key: "holiday_date",
      label: "Tanggal",
      width: "120px",
      render: (r) => (
        <span className="font-semibold text-gray-900">{r.holiday_date}</span>
      ),
    },
    {
      key: "name",
      label: "Nama Hari Libur / Tanggal Merah",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">{r.name}</span>
          {r.is_sunday && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 font-semibold">
              Hari Minggu
            </span>
          )}
        </div>
      ),
    },
    {
      key: "incentive_status",
      label: "Insentif Masuk (Rp50.000)",
      render: (r) => {
        return !r.is_sunday ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            Berlaku Insentif
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
            Tidak Berlaku (Minggu)
          </span>
        );
      },
    },
    ...(canManage
      ? ([
          {
            key: "action",
            label: "Aksi",
            render: (r: HolidayRow) => (
              <button
                type="button"
                disabled={deletingId === r.id}
                onClick={() => handleDelete(r.id, `${r.holiday_date} ${r.name}`)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </button>
            ),
          },
        ] as Column<HolidayRow>[])
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Form Tambah Hari Libur (Superadmin / SO) */}
      {canManage && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm max-w-xl space-y-4">
          <div className="flex items-center gap-2 text-[var(--primary)] font-bold text-[16px]">
            <Calendar className="h-5 w-5" />
            <span>Tambah Tanggal Merah / Libur Nasional</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">Tanggal</label>
              <input
                type="date"
                className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1">Nama Hari Libur</label>
              <input
                type="text"
                placeholder="Contoh: Tahun Baru Hijriah"
                className="w-full min-h-11 rounded-xl border border-gray-300 px-3 text-[13px] focus:outline-none focus:border-[var(--primary)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="text-[12px] text-gray-500">
            * Karyawan bulanan yang clock-in hadir pada tanggal merah selain hari Minggu otomatis mendapatkan insentif <strong>Rp50.000 / hari</strong> pada slip gaji bulanan.
          </p>

          <button type="submit" className={btnPrimary} disabled={submitting}>
            <Plus className="h-4 w-4 mr-1 inline" />
            {submitting ? "Menyimpan..." : "Simpan Tanggal Merah"}
          </button>
        </form>
      )}

      {/* Tabel Master Hari Libur */}
      <div>
        <h2 className="mb-2 text-[16px] font-bold text-gray-900">Daftar Hari Libur Nasional & Tanggal Merah</h2>
        <DataTable data={rows} columns={columns} exportFilename={`Hari_Libur_${new Date().toISOString().slice(0, 10)}`} />
      </div>
    </div>
  );
}
