"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-toast";
import { DataTable } from "@/components/data-table/data-table";
import { Field, formCard, inputClass } from "@/components/hrd/field";
import { MoneyInput } from "@/components/hrd/money-input";
import { Modal } from "@/components/hrd/modal";
import { SearchSelect } from "@/components/shared/search-select";
import { BANK_OPTIONS, EDUCATION_LEVEL_OPTIONS, EMPLOYEE_TYPE_OPTIONS, EMPLOYMENT_STATUS_OPTIONS, FAMILY_RELATION_OPTIONS, MARITAL_OPTIONS, TAX_STATUS_OPTIONS } from "@/lib/hrd/static-options";
import { btnDangerSm, btnPrimary, btnSecondary } from "@/components/ui/button";
import { fmtTenure, parseMoney } from "@/lib/utils/format";
import { firstIssue } from "@/lib/validators/common";
import {
  contractCreateSchema,
  contractPatchSchema,
  educationSchema,
  employeeWriteSchema,
  familySchema,
  salaryComponentAssignSchema,
} from "@/lib/validators/employee";
import type { z } from "zod";

type Opt = { id: string; name: string; code?: string };
type Emp = {
  id: string;
  full_name: string;
  employee_number: string | null;
  record_status: string;
  in_payroll: boolean;
  join_date: string | null;
  gender: string | null;
  marital_status: string | null;
  employment_status: string | null;
  birth_date: string | null;
  address: string | null;
  position_id: string | null;
  rank_id: string | null;
  location_id: string | null;
  pay_group_id: string | null;
  supervisor_employee_id: string | null;
  hourly_rate: string | null;
  tenure_days: number | null;
  email: string | null;
  phone: string | null;
  nik: string | null;
  ktp_image_url: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  npwp: string | null;
  bpjs_kesehatan_id: string | null;
  bpjs_tk_id: string | null;
  tax_status: string | null;
  employee_type: string | null;
  can_clock_outside_radius: boolean;
};

const emptyEmployee: Emp = {
  id: "",
  full_name: "",
  employee_number: null,
  record_status: "draft",
  in_payroll: false,
  join_date: null,
  gender: null,
  marital_status: null,
  employment_status: "contract",
  birth_date: null,
  address: null,
  position_id: null,
  rank_id: null,
  location_id: null,
  pay_group_id: null,
  supervisor_employee_id: null,
  hourly_rate: null,
  tenure_days: null,
  email: null,
  phone: null,
  nik: null,
  ktp_image_url: null,
  bank_name: null,
  bank_account_number: null,
  bank_account_name: null,
  npwp: null,
  bpjs_kesehatan_id: null,
  bpjs_tk_id: null,
  tax_status: null,
  employee_type: "outlet",
  can_clock_outside_radius: false,
};

export function EmployeeProfile({
  mode = "edit",
  employee = emptyEmployee,
  components = [],
  educations = [],
  family = [],
  contracts = [],
  catalogs,
  canEditPay = false,
  canEdit = true,
}: {
  mode?: "create" | "edit";
  employee?: Emp;
  components?: { id: string; code: string; name: string; amount: string; effective_from: string; salary_component_id: string }[];
  educations?: { id: string; level: string; institution: string; major: string | null; start_year: number | null; end_year: number | null }[];
  family?: { id: string; relation: string; full_name: string; birth_date: string | null }[];
  contracts?: { id: string; sequence_no: number; start_date: string; end_date: string; status: string; stage_option_id?: string; stage_code: string; stage_name: string }[];
  canEditPay?: boolean;
  canEdit?: boolean;
  catalogs: {
    positions: Opt[];
    ranks: Opt[];
    payGroups: Opt[];
    locations: Opt[];
    employeeTypes?: { value: string; label: string }[];
    supervisors: Opt[];
    salaryComponents: Opt[];
    stages: Opt[];
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState("dasar");
  const [form, setForm] = useState({
    fullName: employee.full_name,
    employeeNumber: employee.employee_number ?? "",
    gender: employee.gender ?? "",
    maritalStatus: employee.marital_status ?? "",
    employmentStatus: employee.employment_status ?? "contract",
    birthDate: employee.birth_date ? String(employee.birth_date).slice(0, 10) : "",
    address: employee.address ?? "",
    joinDate: employee.join_date ? String(employee.join_date).slice(0, 10) : "",
    positionId: employee.position_id ?? "",
    rankId: employee.rank_id ?? "",
    locationId: employee.location_id ?? "",
    payGroupId: employee.pay_group_id ?? "",
    employeeType: employee.employee_type ?? "outlet",
    canClockOutsideRadius: Boolean(employee.can_clock_outside_radius),
    supervisorEmployeeId: employee.supervisor_employee_id ?? "",
    recordStatus: employee.record_status,
    inPayroll: employee.in_payroll,
    nik: employee.nik ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    bankName: employee.bank_name ?? "",
    bankAccountNumber: employee.bank_account_number ?? "",
    bankAccountName: employee.bank_account_name ?? "",
    npwp: employee.npwp ?? "",
    bpjsKesehatanId: employee.bpjs_kesehatan_id ?? "",
    bpjsTkId: employee.bpjs_tk_id ?? "",
    taxStatus: employee.tax_status ?? "",
  });

  const opts = (rows: Opt[]) => rows.map((o) => ({ value: o.id, label: o.code ? `${o.code} — ${o.name}` : o.name }));

  function payload() {
    return {
      ...form,
      employeeNumber: form.employeeNumber || null,
      joinDate: form.joinDate || null,
      birthDate: form.birthDate || null,
      address: form.address || null,
      positionId: form.positionId || null,
      rankId: form.rankId || null,
      locationId: form.locationId || null,
      payGroupId: form.payGroupId || null,
      employeeType: form.employeeType || "outlet",
      canClockOutsideRadius: Boolean(form.canClockOutsideRadius),
      supervisorEmployeeId: form.supervisorEmployeeId || null,
      maritalStatus: form.maritalStatus || null,
      employmentStatus: form.employmentStatus || "contract",
      nik: form.nik || null,
      email: form.email.trim().toLowerCase(),
      phone: form.phone || null,
      bankName: form.bankName || null,
      bankAccountNumber: form.bankAccountNumber || null,
      bankAccountName: form.bankAccountName || null,
      npwp: form.npwp || null,
      bpjsKesehatanId: form.bpjsKesehatanId || null,
      bpjsTkId: form.bpjsTkId || null,
      taxStatus: form.taxStatus || null,
    };
  }

  async function saveIdentity() {
    const creating = mode === "create";
    const parsed = employeeWriteSchema.safeParse(payload());
    if (!parsed.success) {
      toast.error(firstIssue(parsed.error));
      return;
    }
    const res = await fetch(creating ? "/api/employees" : `/api/employees/${employee.id}`, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal simpan");
      return;
    }
    const json = await res.json().catch(() => ({}));
    toast.success(creating ? "Karyawan tersimpan" : "Data dasar tersimpan");
    if (creating && json.id) router.push(`/employees/${json.id}`);
    else router.refresh();
  }

  async function uploadKtp(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/employees/${employee.id}/ktp`, { method: "POST", body: fd });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Unggah KTP gagal");
      return;
    }
    toast.success("KTP tersimpan");
    router.refresh();
  }

  const tabs = [
    ["dasar", "Profil"],
    ["pendidikan", "Pendidikan"],
    ["keluarga", "Keluarga"],
    ["kontrak", "Kontrak"],
    ["upah", "Komponen upah"],
  ] as const;

  const activeContract = [...contracts].filter((c) => c.status === "active").sort((a, b) => b.sequence_no - a.sequence_no)[0];
  const canAdvance = activeContract && (activeContract.stage_code === "training_1m" || activeContract.stage_code === "training_3m");

  function goTab(id: string) {
    if (mode === "create" && id !== "dasar") {
      toast.message("Simpan data dasar dulu, lalu lengkapi pendidikan, keluarga, dan kontrak.");
      return;
    }
    setTab(id);
  }

  return (
    <div className="pb-10">
      <Link
        href="/employees"
        className={`${btnSecondary} mb-3 inline-flex w-full items-center justify-center gap-1 no-underline sm:w-auto`}
      >
        <ChevronLeft size={16} />
        Kembali ke daftar
      </Link>
      <h1 className="mb-1 mt-0 text-[20px] font-bold text-[var(--primary)] md:text-[24px]">
        {mode === "create" ? "Karyawan baru" : employee.full_name}
      </h1>
      <p className="mb-4 text-[12px] leading-relaxed text-[#666] md:mb-6 md:text-[14px]">
        {mode === "create"
          ? "Isi data dasar di halaman ini (bukan modal). Pendidikan, keluarga, dan kontrak ditambah lewat modal setelah tersimpan."
          : `Status ${employee.record_status}${employee.tenure_days != null ? ` · masa kerja ${fmtTenure(employee.tenure_days)}` : ""}`}
      </p>
      {activeContract && (
        <div className={`${formCard} mb-4 md:mb-6`}>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-[#4d6e68]">Kontrak aktif (paling mutakhir)</p>
          <p className="mt-1 mb-0 text-[14px] font-semibold text-[#1a1a1a] md:text-[16px]">
            {activeContract.stage_name} · {String(activeContract.start_date).slice(0, 10)} – {String(activeContract.end_date).slice(0, 10)}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
        <aside className="min-w-0 md:sticky md:top-4 md:w-56 md:shrink-0">
          <nav className="flex flex-row gap-1 overflow-x-auto overscroll-x-contain rounded-2xl p-2 backdrop-blur-xl bg-[color-mix(in_srgb,var(--primary)_14%,white)] md:flex-col md:overflow-visible">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-xl px-3 text-[13px] md:w-full md:text-left ${tab === id ? "bg-white font-semibold text-[var(--primary)]" : "bg-transparent text-[#555]"
                  }`}
                onClick={() => goTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          {tab === "dasar" && (
            <div className={formCard}>
              <p className="mt-0 mb-4 text-[13px] text-[#5a6b67] md:text-[14px]">Identitas, alamat, jabatan, dan atasan dalam satu form. NIK dan KTP opsional.</p>
              <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-5">
                  <Field label="Nama lengkap">
                    <input className={inputClass} maxLength={255} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                  </Field>
                  <Field label="Nomor karyawan" hint="Kosong = otomatis CW + 3 digit">
                    <input className={inputClass} maxLength={5} pattern="CW[0-9]{3}" placeholder="CW001" value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Jenis kelamin">
                    <SearchSelect
                      value={form.gender}
                      onChange={(v) => setForm({ ...form, gender: v })}
                      options={[
                        { value: "male", label: "Laki-laki" },
                        { value: "female", label: "Perempuan" },
                      ]}
                      placeholder="Pilih jenis kelamin"
                    />
                  </Field>
                  <Field label="Status pernikahan">
                    <SearchSelect
                      value={form.maritalStatus}
                      onChange={(v) => setForm({ ...form, maritalStatus: v })}
                      options={MARITAL_OPTIONS}
                      placeholder="Pilih status pernikahan"
                    />
                  </Field>
                  <Field label="Tanggal lahir">
                    <input className={inputClass} type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                  </Field>
                  <Field label="Tanggal bergabung" hint="Kosong = tetap draf">
                    <input className={inputClass} type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
                  </Field>
                  <Field label="Alamat" className="md:col-span-2">
                    <textarea className={`${inputClass} min-h-20 py-2`} maxLength={1000} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </Field>
                  <Field label="Status data">
                    <SearchSelect
                      value={form.recordStatus}
                      onChange={(v) => setForm({ ...form, recordStatus: v })}
                      options={[
                        { value: "draft", label: "Draf" },
                        { value: "active", label: "Aktif" },
                      ]}
                      allowClear={false}
                    />
                  </Field>
                  <Field label="Status karyawan" hint="Tetap, kontrak, atau training">
                    <SearchSelect
                      value={form.employmentStatus}
                      onChange={(v) => setForm({ ...form, employmentStatus: v })}
                      options={EMPLOYMENT_STATUS_OPTIONS}
                      allowClear={false}
                    />
                  </Field>
                  <Field label="Jabatan">
                    <SearchSelect value={form.positionId} onChange={(v) => setForm({ ...form, positionId: v })} options={opts(catalogs.positions)} placeholder="Cari jabatan" />
                  </Field>
                  <Field label="Pangkat">
                    <SearchSelect value={form.rankId} onChange={(v) => setForm({ ...form, rankId: v })} options={opts(catalogs.ranks)} placeholder="Cari pangkat" />
                  </Field>
                  <Field label="Kelompok gaji">
                    <SearchSelect value={form.payGroupId} onChange={(v) => setForm({ ...form, payGroupId: v })} options={opts(catalogs.payGroups)} placeholder="Cari kelompok" />
                  </Field>
                  <Field label="Jenis karyawan">
                    <SearchSelect
                      value={form.employeeType}
                      onChange={(v) => setForm({ ...form, employeeType: v })}
                      options={catalogs.employeeTypes && catalogs.employeeTypes.length > 0 ? catalogs.employeeTypes : EMPLOYEE_TYPE_OPTIONS}
                      placeholder="Pilih jenis karyawan"
                      allowClear={false}
                    />
                  </Field>
                  <Field label="Izin absen luar radius">
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="canClockOutsideRadius"
                        checked={form.canClockOutsideRadius}
                        onChange={(e) => setForm({ ...form, canClockOutsideRadius: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <label htmlFor="canClockOutsideRadius" className="text-[13px] text-gray-700">
                        Boleh absen di luar radius (wajib isi alasan)
                      </label>
                    </div>
                  </Field>
                  <Field label="Lokasi">
                    <SearchSelect value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v })} options={opts(catalogs.locations)} placeholder="Cari lokasi" />
                  </Field>
                  <Field label="Atasan langsung" className="md:col-span-2" hint="Satu orang, tanpa hierarki bertingkat">
                    <SearchSelect
                      value={form.supervisorEmployeeId}
                      onChange={(v) => setForm({ ...form, supervisorEmployeeId: v })}
                      options={opts(catalogs.supervisors.filter((s) => s.id !== employee.id))}
                      placeholder="Cari nama atasan"
                    />
                  </Field>
                  <Field label="NIK (opsional)" hint="16 digit, hanya di tab ini">
                    <input className={inputClass} inputMode="numeric" maxLength={16} pattern="[0-9]{16}" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, "").slice(0, 16) })} />
                  </Field>
                  <Field label="NPWP" hint="15 atau 16 digit">
                    <input className={inputClass} inputMode="numeric" maxLength={16} value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value.replace(/\D/g, "").slice(0, 16) })} />
                  </Field>
                  <Field label="Status pajak (PTKP)">
                    <SearchSelect
                      value={form.taxStatus}
                      onChange={(v) => setForm({ ...form, taxStatus: v })}
                      options={TAX_STATUS_OPTIONS}
                      placeholder="Pilih TK/0, K/1, …"
                    />
                  </Field>
                  <Field label="BPJS Kesehatan" hint="13 digit">
                    <input className={inputClass} inputMode="numeric" maxLength={13} value={form.bpjsKesehatanId} onChange={(e) => setForm({ ...form, bpjsKesehatanId: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
                  </Field>
                  <Field label="BPJS Ketenagakerjaan" hint="11 digit">
                    <input className={inputClass} inputMode="numeric" maxLength={11} value={form.bpjsTkId} onChange={(e) => setForm({ ...form, bpjsTkId: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
                  </Field>
                  <Field label="Email">
                    <input className={inputClass} type="email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>
                  <Field label="HP (opsional)">
                    <input className={inputClass} inputMode="tel" maxLength={16} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, "").slice(0, 16) })} />
                  </Field>
                  <Field label="Bank">
                    <SearchSelect
                      value={form.bankName}
                      onChange={(v) => setForm({ ...form, bankName: v })}
                      options={BANK_OPTIONS}
                      placeholder="Pilih bank"
                    />
                  </Field>
                  <Field label="Nomor rekening">
                    <input className={inputClass} inputMode="numeric" maxLength={20} value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value.replace(/\D/g, "").slice(0, 20) })} />
                  </Field>
                  <Field label="Atas nama rekening" className="md:col-span-2">
                    <input className={inputClass} maxLength={255} value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} />
                  </Field>
                  {mode === "edit" ? (
                    <Field label="Foto KTP (opsional)" className="md:col-span-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {employee.ktp_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={employee.ktp_image_url} alt="KTP" className="max-h-32 rounded-2xl bg-white object-contain p-2" />
                        ) : null}
                        <input className="block text-[13px]" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadKtp(e.target.files[0])} />
                        {employee.ktp_image_url ? (
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={async () => {
                              await fetch(`/api/employees/${employee.id}/ktp`, { method: "DELETE" });
                              router.refresh();
                            }}
                          >
                            Hapus KTP
                          </button>
                        ) : null}
                      </div>
                    </Field>
                  ) : null}
                </div>
              </fieldset>
              {canEdit ? (
                <div className="mt-6 flex flex-col gap-2 md:flex-row">
                  <button type="button" className={`${btnPrimary} w-full md:w-auto`} onClick={saveIdentity}>
                    {mode === "create" ? "Simpan karyawan" : "Simpan data dasar"}
                  </button>
                  {mode === "create" ? (
                    <button type="button" className={`${btnSecondary} w-full md:w-auto`} onClick={() => router.push("/employees")}>
                      Batal
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mb-0 mt-4 text-[13px] text-[#666]">Mode lihat. Atasan tidak mengubah data karyawan.</p>
              )}
            </div>
          )}

          {tab === "pendidikan" && (
            <NestedModalList
              title="Pendidikan"
              rows={educations}
              columns={[
                { key: "level", label: "Jenjang" },
                { key: "institution", label: "Institusi" },
                { key: "major", label: "Jurusan" },
              ]}
              onDelete={async (id) => {
                await fetch(`/api/employees/${employee.id}/educations?educationId=${id}`, { method: "DELETE" });
                router.refresh();
              }}
              fields={[
                { name: "level", label: "Jenjang", kind: "select", options: EDUCATION_LEVEL_OPTIONS },
                { name: "institution", label: "Institusi" },
                { name: "major", label: "Jurusan" },
                { name: "startYear", label: "Tahun mulai", type: "number" },
                { name: "endYear", label: "Tahun selesai", type: "number" },
              ]}
              action={`/api/employees/${employee.id}/educations`}
              schema={educationSchema}
              idParam="educationId"
              rowValues={(r) => ({
                level: String(r.level ?? ""),
                institution: String(r.institution ?? ""),
                major: String(r.major ?? ""),
                startYear: r.start_year != null ? String(r.start_year) : "",
                endYear: r.end_year != null ? String(r.end_year) : "",
              })}
              readOnly={!canEdit}
            />
          )}

          {tab === "keluarga" && (
            <NestedModalList
              title="Anggota keluarga"
              rows={family}
              columns={[
                { key: "relation", label: "Hubungan", render: (r) => FAMILY_RELATION_OPTIONS.find((o) => o.id === r.relation)?.name ?? r.relation },
                { key: "full_name", label: "Nama" },
                { key: "birth_date", label: "Lahir" },
              ]}
              onDelete={async (id) => {
                await fetch(`/api/employees/${employee.id}/family?familyId=${id}`, { method: "DELETE" });
                router.refresh();
              }}
              fields={[
                { name: "relation", label: "Hubungan", kind: "select", options: FAMILY_RELATION_OPTIONS },
                { name: "fullName", label: "Nama" },
                { name: "birthDate", label: "Tanggal lahir", type: "date" },
              ]}
              action={`/api/employees/${employee.id}/family`}
              schema={familySchema}
              idParam="familyId"
              rowValues={(r) => ({
                relation: String(r.relation ?? ""),
                fullName: String(r.full_name ?? ""),
                birthDate: r.birth_date ? String(r.birth_date).slice(0, 10) : "",
              })}
              readOnly={!canEdit}
            />
          )}

          {tab === "kontrak" && (
            <div className={formCard}>
              <p className="mt-0 mb-3 text-[13px] text-[#777]">Kontrak aktif adalah tahap paling mutakhir. Riwayat tahap tetap terlihat di bawah.</p>
              {canEditPay ? (
                <ContractActions employeeId={employee.id} stages={catalogs.stages} canAdvance={Boolean(canAdvance)} />
              ) : null}
              <div className="mt-4 overflow-x-auto">
                <ContractTable employeeId={employee.id} rows={contracts} stages={catalogs.stages} readOnly={!canEditPay} />
              </div>
            </div>
          )}

          {tab === "upah" && mode === "edit" && (
            <NestedModalList
              title="Komponen upah"
              rows={components}
              columns={[
                { key: "code", label: "Kode" },
                { key: "name", label: "Nama" },
                { key: "amount", label: "Nominal", money: true },
                { key: "effective_from", label: "Dari" },
              ]}
              fields={[
                { name: "salaryComponentId", label: "Komponen", kind: "select", options: catalogs.salaryComponents },
                { name: "amount", label: "Nominal", kind: "money" },
                { name: "effectiveFrom", label: "Berlaku dari", type: "date" },
              ]}
              action="/api/employee-salary-components"
              extra={{ employeeId: employee.id }}
              schema={salaryComponentAssignSchema}
              idParam="id"
              onDelete={async (id) => {
                await fetch(`/api/employee-salary-components?id=${id}`, { method: "DELETE" });
                router.refresh();
              }}
              rowValues={(r) => ({
                salaryComponentId: String(r.salary_component_id ?? ""),
                amount: r.amount == null || r.amount === "" ? "" : String(Math.round(Number(r.amount))),
                effectiveFrom: r.effective_from ? String(r.effective_from).slice(0, 10) : "",
              })}
              readOnly={!canEditPay}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ContractActions({ employeeId, stages, canAdvance }: { employeeId: string; stages: Opt[]; canAdvance: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stageOptionId, setStage] = useState(stages[0]?.id ?? "");
  const [startDate, setStart] = useState("");
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={() => setOpen(true)}>
        Mulai tahap
      </button>
      {canAdvance && (
        <button
          type="button"
          className={`${btnPrimary} w-full sm:w-auto`}
          onClick={async () => {
            const res = await fetch(`/api/employees/${employeeId}/contracts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ advance: true }),
            });
            if (!res.ok) {
              const json = await res.json().catch(() => ({}));
              toast.error(typeof json.error === "string" ? json.error : "Tidak bisa lanjut tahap");
              return;
            }
            toast.success("Tahap berikutnya aktif");
            router.refresh();
          }}
        >
          Lanjut tahap
        </button>
      )}
      {open && (
        <Modal title="Mulai kontrak" onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            <Field label="Tahap">
              <SearchSelect value={stageOptionId} onChange={setStage} options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear={false} />
            </Field>
            <Field label="Tanggal mulai">
              <input className={inputClass} type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <button
              type="button"
              className={btnPrimary}
              onClick={async () => {
                const parsed = contractCreateSchema.safeParse({ stageOptionId, startDate });
                if (!parsed.success) {
                  toast.error(firstIssue(parsed.error));
                  return;
                }
                const res = await fetch(`/api/employees/${employeeId}/contracts`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(parsed.data),
                });
                if (!res.ok) toast.error("Gagal membuat kontrak");
                else {
                  toast.success("Kontrak aktif");
                  setOpen(false);
                  router.refresh();
                }
              }}
            >
              Simpan tahap
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NestedModalList({
  title,
  rows,
  columns,
  fields,
  action,
  extra,
  onDelete,
  idParam,
  rowValues,
  schema,
  readOnly = false,
}: {
  title: string;
  rows: { id: string }[];
  columns: { key: string; label: string; money?: boolean; render?: (row: { id: string } & Record<string, string>) => React.ReactNode }[];
  fields: { name: string; label: string; type?: string; kind?: string; options?: Opt[] }[];
  action: string;
  extra?: Record<string, string>;
  onDelete?: (id: string) => void;
  idParam?: string;
  rowValues?: (row: Record<string, unknown>) => Record<string, string>;
  schema?: z.ZodType;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  function openCreate() {
    setEditingId(null);
    setValues({});
    setOpen(true);
  }

  function openEdit(row: { id: string } & Record<string, string>) {
    setEditingId(row.id);
    setValues(rowValues ? rowValues(row as Record<string, unknown>) : {});
    setOpen(true);
  }

  async function submit() {
    const body: Record<string, unknown> = { ...extra };
    if (editingId && idParam) body[idParam] = editingId;
    for (const f of fields) {
      const raw = values[f.name] ?? "";
      if (f.kind === "money") body[f.name] = parseMoney(raw);
      else body[f.name] = f.type === "number" ? (raw === "" ? null : Number(raw)) : raw || null;
    }
    if (schema) {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        toast.error(firstIssue(parsed.error));
        return;
      }
      Object.assign(body, parsed.data);
    }
    const res = await fetch(action, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json.error === "string" ? json.error : "Gagal");
      return;
    }
    toast.success("Tersimpan");
    setOpen(false);
    setEditingId(null);
    setValues({});
    router.refresh();
  }

  return (
    <div className={formCard}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-[13px] text-[#777]">{title}</p>
        {readOnly ? null : (
          <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={openCreate}>
            Tambah
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <DataTable
          data={rows}
          columns={[
            ...columns,
            ...(readOnly
              ? []
              : [
                {
                  key: "id",
                  label: "Aksi",
                  render: (r: { id: string } & Record<string, string>) => (
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={btnSecondary} onClick={() => openEdit(r)}>Ubah</button>
                      {onDelete ? (
                        <button
                          type="button"
                          className={btnDangerSm}
                          onClick={async () => {
                            if (!(await confirmAction("Hapus data ini?", "Hapus"))) return;
                            onDelete(r.id);
                          }}
                        >
                          Hapus
                        </button>
                      ) : null}
                    </div>
                  ),
                },
              ]),
          ]}
        />
      </div>
      {open && (
        <Modal title={`${editingId ? "Ubah" : "Tambah"} ${title.toLowerCase()}`} onClose={() => setOpen(false)}>
          <div className="grid gap-3">
            {fields.map((f) =>
              f.kind === "select" && f.options ? (
                <Field key={f.name} label={f.label}>
                  <SearchSelect
                    value={values[f.name] ?? ""}
                    onChange={(v) => setValues({ ...values, [f.name]: v })}
                    options={f.options.map((o) => ({ value: o.id, label: o.name }))}
                    placeholder={`Pilih ${f.label.toLowerCase()}`}
                  />
                </Field>
              ) : f.kind === "money" ? (
                <Field key={f.name} label={f.label} hint="Rupiah utuh, tanpa desimal">
                  <MoneyInput value={values[f.name] ?? ""} onChange={(v) => setValues({ ...values, [f.name]: v })} />
                </Field>
              ) : (
                <Field key={f.name} label={f.label}>
                  <input
                    className={inputClass}
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                </Field>
              ),
            )}
            <button type="button" className={btnPrimary} onClick={submit}>Simpan</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ContractTable({
  employeeId,
  rows,
  stages,
  readOnly = false,
}: {
  employeeId: string;
  rows: { id: string; sequence_no: number; start_date: string; end_date: string; status: string; stage_option_id?: string; stage_code: string; stage_name: string }[];
  stages: Opt[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<(typeof rows)[0] | null>(null);
  const [stageOptionId, setStage] = useState("");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [status, setStatus] = useState("active");

  function open(row: (typeof rows)[0]) {
    setEdit(row);
    setStage(row.stage_option_id ?? stages.find((s) => s.name === row.stage_name)?.id ?? "");
    setStart(String(row.start_date).slice(0, 10));
    setEnd(String(row.end_date).slice(0, 10));
    setStatus(row.status);
  }

  return (
    <>
      <DataTable
        data={rows}
        columns={[
          { key: "sequence_no", label: "Urutan" },
          { key: "stage_name", label: "Tahap" },
          { key: "start_date", label: "Awal" },
          { key: "end_date", label: "Akhir" },
          { key: "status", label: "Status", render: (r) => (r.status === "active" ? "aktif" : r.status) },
          ...(readOnly
            ? []
            : [
              {
                key: "id",
                label: "Aksi",
                render: (r: (typeof rows)[0]) => (
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={btnSecondary} onClick={() => open(r)}>Ubah</button>
                    <button
                      type="button"
                      className={btnDangerSm}
                      onClick={async () => {
                        if (!(await confirmAction("Hapus tahap kontrak ini?", "Hapus"))) return;
                        await fetch(`/api/employees/${employeeId}/contracts?contractId=${r.id}`, { method: "DELETE" });
                        router.refresh();
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                ),
              },
            ]),
        ]}
      />
      {edit && (
        <Modal title="Ubah kontrak" onClose={() => setEdit(null)}>
          <div className="grid gap-3">
            <Field label="Tahap">
              <SearchSelect value={stageOptionId} onChange={setStage} options={stages.map((s) => ({ value: s.id, label: s.name }))} allowClear={false} />
            </Field>
            <Field label="Tanggal mulai">
              <input className={inputClass} type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Tanggal akhir">
              <input className={inputClass} type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Field label="Status">
              <SearchSelect
                value={status}
                onChange={setStatus}
                options={[
                  { value: "active", label: "Aktif" },
                  { value: "completed", label: "Selesai" },
                  { value: "scheduled", label: "Terjadwal" },
                ]}
                allowClear={false}
              />
            </Field>
            <button
              type="button"
              className={btnPrimary}
              onClick={async () => {
                const parsed = contractPatchSchema.safeParse({ contractId: edit.id, stageOptionId, startDate, endDate, status });
                if (!parsed.success) {
                  toast.error(firstIssue(parsed.error));
                  return;
                }
                const res = await fetch(`/api/employees/${employeeId}/contracts`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(parsed.data),
                });
                if (!res.ok) toast.error("Gagal mengubah kontrak");
                else {
                  toast.success("Kontrak diubah");
                  setEdit(null);
                  router.refresh();
                }
              }}
            >
              Simpan
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
