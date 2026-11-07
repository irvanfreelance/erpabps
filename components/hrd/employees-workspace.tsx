"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Field, formCard } from "@/components/hrd/field";
import { SearchSelect } from "@/components/shared/search-select";
import { btnDangerSm, btnPrimary, btnSecondary } from "@/components/ui/button";
import { EMPLOYMENT_STATUS_OPTIONS } from "@/lib/hrd/static-options";
import { fmtDate, fmtTenure } from "@/lib/utils/format";

type Row = {
  id: string;
  full_name: string;
  employee_number: string | null;
  record_status: string;
  employment_status: string | null;
  gender: string | null;
  in_payroll: boolean;
  position_name: string | null;
  rank_name: string | null;
  location_name: string | null;
  pay_group_name: string | null;
  supervisor_name: string | null;
  join_date: string | null;
  tenure_days: number | null;
  contract_stage: string | null;
  contract_end: string | null;
  ending_soon: boolean;
};

const GENDER_LABEL: Record<string, string> = { male: "Laki-laki", female: "Perempuan" };
const STATUS_LABEL: Record<string, string> = { draft: "Draf", active: "Aktif" };
const EMP_LABEL = Object.fromEntries(EMPLOYMENT_STATUS_OPTIONS.map((o) => [o.value, o.label]));

const filterParsers = {
  status: parseAsString.withDefault(""),
  employment: parseAsString.withDefault(""),
  position: parseAsString.withDefault(""),
  rank: parseAsString.withDefault(""),
  location: parseAsString.withDefault(""),
  payGroup: parseAsString.withDefault(""),
  supervisor: parseAsString.withDefault(""),
  gender: parseAsString.withDefault(""),
  payroll: parseAsString.withDefault(""),
  ending: parseAsBoolean.withDefault(false),
};

function uniq(rows: Row[], key: keyof Row, labels?: Record<string, string>) {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const raw = r[key];
    if (raw == null || raw === "") continue;
    const value = String(raw);
    if (!seen.has(value)) seen.set(value, labels?.[value] ?? value);
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "id"))
    .map(([value, label]) => ({ value, label }));
}

export function EmployeesWorkspace({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useQueryStates(filterParsers, { history: "replace" });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (f.status && r.record_status !== f.status) return false;
      if (f.employment && r.employment_status !== f.employment) return false;
      if (f.position && r.position_name !== f.position) return false;
      if (f.rank && r.rank_name !== f.rank) return false;
      if (f.location && r.location_name !== f.location) return false;
      if (f.payGroup && r.pay_group_name !== f.payGroup) return false;
      if (f.supervisor && r.supervisor_name !== f.supervisor) return false;
      if (f.gender && r.gender !== f.gender) return false;
      if (f.payroll === "yes" && !r.in_payroll) return false;
      if (f.payroll === "no" && r.in_payroll) return false;
      if (f.ending && !r.ending_soon) return false;
      return true;
    });
  }, [rows, f]);

  const chips = useMemo(() => {
    const items: { key: keyof typeof filterParsers; label: string }[] = [];
    if (f.status) items.push({ key: "status", label: `Status: ${STATUS_LABEL[f.status] ?? f.status}` });
    if (f.employment) items.push({ key: "employment", label: `Karyawan: ${EMP_LABEL[f.employment] ?? f.employment}` });
    if (f.position) items.push({ key: "position", label: `Jabatan: ${f.position}` });
    if (f.rank) items.push({ key: "rank", label: `Pangkat: ${f.rank}` });
    if (f.location) items.push({ key: "location", label: `Lokasi: ${f.location}` });
    if (f.payGroup) items.push({ key: "payGroup", label: `Kelompok: ${f.payGroup}` });
    if (f.supervisor) items.push({ key: "supervisor", label: `Atasan: ${f.supervisor}` });
    if (f.gender) items.push({ key: "gender", label: `Kelamin: ${GENDER_LABEL[f.gender] ?? f.gender}` });
    if (f.payroll) items.push({ key: "payroll", label: `Payroll: ${f.payroll === "yes" ? "Ikut" : "Tidak ikut"}` });
    if (f.ending) items.push({ key: "ending", label: "Kontrak hampir berakhir" });
    return items;
  }, [f]);

  async function remove(id: string) {
    if (!(await confirmAction("Hapus karyawan ini?", "Hapus"))) return;
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Gagal");
    else {
      toast.success("Diarsipkan");
      router.refresh();
    }
  }

  async function onImport(file: File) {
    setImporting(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/employees/import", { method: "POST", body: fd });
    setImporting(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json.error === "string" ? json.error : "Impor gagal");
      return;
    }
    const errN = Array.isArray(json.errors) ? json.errors.length : 0;
    toast.success(`Impor ${json.created ?? 0} baris${errN ? `, ${errN} peringatan` : ""}`);
    if (errN) toast.message(json.errors.slice(0, 3).map((e: { row: number; message: string }) => `Baris ${e.row}: ${e.message}`).join(" · "));
    router.refresh();
  }


  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <Link href="/employees/new" className={`${btnPrimary} w-full md:w-auto`}>
          Tambah karyawan
        </Link>
        <a href="/api/employees/import" className={`${btnSecondary} w-full md:w-auto`}>
          Unduh template Excel
        </a>
        <button type="button" className={`${btnSecondary} w-full md:w-auto`} onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? "Mengimpor…" : "Unggah Excel"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onImport(f);
          }}
        />
        <button
          type="button"
          className={`${btnSecondary} w-full md:w-auto`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal size={16} />
          {open ? "Tutup filter" : "Buka filter"}
          {chips.length ? ` (${chips.length})` : ""}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {!open && chips.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,white)] px-3 text-[12px] font-semibold text-[var(--primary)]"
              onClick={() => void setF({ [c.key]: c.key === "ending" ? false : "" })}
            >
              {c.label}
              <X size={14} />
            </button>
          ))}
        </div>
      ) : null}

      {open && (
        <div className={`${formCard} relative z-20 mb-3 overflow-visible`}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-[13px] font-semibold text-[#4d6e68]">Filter bisa digabung. Semua yang dipilih berlaku sekaligus.</p>
            <button
              type="button"
              className={`${btnSecondary} w-full sm:w-auto`}
              disabled={chips.length === 0}
              onClick={() =>
                void setF({
                  status: "",
                  employment: "",
                  position: "",
                  rank: "",
                  location: "",
                  payGroup: "",
                  supervisor: "",
                  gender: "",
                  payroll: "",
                  ending: false,
                })
              }
            >
              Hapus semua filter
            </button>
          </div>
          <div className="relative z-10 grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Field label="Status data">
              <SearchSelect
                value={f.status}
                onChange={(v) => void setF({ status: v })}
                options={[
                  { value: "draft", label: "Draf" },
                  { value: "active", label: "Aktif" },
                ]}
                placeholder="Semua status"
              />
            </Field>
            <Field label="Status karyawan">
              <SearchSelect
                value={f.employment}
                onChange={(v) => void setF({ employment: v })}
                options={EMPLOYMENT_STATUS_OPTIONS}
                placeholder="Tetap / kontrak / training"
              />
            </Field>
            <Field label="Jabatan">
              <SearchSelect value={f.position} onChange={(v) => void setF({ position: v })} options={uniq(rows, "position_name")} placeholder="Semua jabatan" />
            </Field>
            <Field label="Pangkat">
              <SearchSelect value={f.rank} onChange={(v) => void setF({ rank: v })} options={uniq(rows, "rank_name")} placeholder="Semua pangkat" />
            </Field>
            <Field label="Lokasi">
              <SearchSelect value={f.location} onChange={(v) => void setF({ location: v })} options={uniq(rows, "location_name")} placeholder="Semua lokasi" />
            </Field>
            <Field label="Kelompok gaji">
              <SearchSelect value={f.payGroup} onChange={(v) => void setF({ payGroup: v })} options={uniq(rows, "pay_group_name")} placeholder="Semua kelompok" />
            </Field>
            <Field label="Atasan">
              <SearchSelect value={f.supervisor} onChange={(v) => void setF({ supervisor: v })} options={uniq(rows, "supervisor_name")} placeholder="Semua atasan" />
            </Field>
            <Field label="Jenis kelamin">
              <SearchSelect
                value={f.gender}
                onChange={(v) => void setF({ gender: v })}
                options={[
                  { value: "male", label: "Laki-laki" },
                  { value: "female", label: "Perempuan" },
                ]}
                placeholder="Semua"
              />
            </Field>
            <Field label="Ikut payroll">
              <SearchSelect
                value={f.payroll}
                onChange={(v) => void setF({ payroll: v })}
                options={[
                  { value: "yes", label: "Ikut" },
                  { value: "no", label: "Tidak ikut" },
                ]}
                placeholder="Semua"
              />
            </Field>
            <Field label="Kontrak">
              <SearchSelect
                value={f.ending ? "soon" : ""}
                onChange={(v) => void setF({ ending: v === "soon" })}
                options={[{ value: "soon", label: "Hampir berakhir (≤ 30 hari)" }]}
                placeholder="Semua kontrak"
              />
            </Field>
          </div>
          {chips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-semibold text-[var(--primary)]"
                  onClick={() => void setF({ [c.key]: c.key === "ending" ? false : "" })}
                >
                  {c.label}
                  <X size={14} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <p className="mb-3 text-[12px] text-[#888] md:text-[13px]">
        Menampilkan {filtered.length} dari {rows.length} karyawan
        {chips.length ? ` · ${chips.length} filter aktif` : ""}. Cari nama di kotak tabel.
      </p>
      <div className={`${formCard} relative z-0 p-2 md:p-5`}>
        <DataTable
          data={filtered}
          exportFilename="karyawan"
          onRow={(r) => router.push(`/employees/${r.id}`)}
          columns={[
            { key: "full_name", label: "Nama", sticky: "left", width: "14rem", hideable: false },
            { key: "employee_number", label: "Nomor", width: "5.5rem" },
            { key: "position_name", label: "Jabatan", width: "8rem" },
            { key: "rank_name", label: "Pangkat", width: "7.5rem" },
            { key: "location_name", label: "Lokasi", width: "8rem" },
            { key: "pay_group_name", label: "Kelompok", width: "9.5rem" },
            { key: "supervisor_name", label: "Atasan", width: "8rem" },
            { key: "join_date", label: "Bergabung", width: "7.5rem", render: (r) => fmtDate(r.join_date) },
            { key: "tenure_days", label: "Masa kerja", width: "8rem", render: (r) => fmtTenure(r.tenure_days) },
            { key: "contract_stage", label: "Kontrak", width: "8.5rem" },
            {
              key: "contract_end",
              label: "Akhir kontrak",
              width: "14rem",
              render: (r) =>
                r.ending_soon ? (
                  <span className="font-semibold text-amber-700">{fmtDate(r.contract_end)} · hampir berakhir</span>
                ) : (
                  fmtDate(r.contract_end)
                ),
            },
            { key: "record_status", label: "Status", width: "5rem" },
            { key: "id", label: "Aksi", sticky: "right", width: "5.5rem", hideable: false, includeInExport: false, render: (r) => (
              <button type="button" className={btnDangerSm} onClick={() => remove(r.id)}>Hapus</button>
            ) },
          ]}
        />
      </div>
    </div>
  );
}
