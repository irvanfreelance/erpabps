import { z } from "zod";
import {
  BANK_NAMES,
  EDUCATION_LEVELS,
  EMPLOYEE_TYPES,
  EMPLOYMENT_STATUSES,
  FAMILY_RELATIONS,
  GENDERS,
  MARITAL_STATUSES,
  TAX_STATUSES,
} from "@/lib/hrd/static-options";
import {
  RE,
  blankToNull,
  moneyAmount,
  optionalBigintId,
  optionalIsoDate,
  optionalName,
  optionalText,
  optionalYear,
  requiredBigintId,
  requiredIsoDate,
  requiredName,
} from "@/lib/validators/common";

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.preprocess(
    blankToNull,
    z.enum(values, { error: `Pilih ${label} yang valid` }).nullable().optional(),
  );

const employeeFields = z.object({
    fullName: requiredName("Nama lengkap"),
    employeeNumber: z.preprocess(
      blankToNull,
      z
        .string()
        .regex(RE.employeeNumber, "Nomor karyawan harus CW diikuti 3 digit, atau kosong")
        .nullable()
        .optional(),
    ),
    gender: optionalEnum(GENDERS, "jenis kelamin"),
    birthDate: optionalIsoDate("Tanggal lahir"),
    address: optionalText(1000, "Alamat"),
    joinDate: optionalIsoDate("Tanggal bergabung"),
    locationId: optionalBigintId,
    positionId: optionalBigintId,
    rankId: optionalBigintId,
    payGroupId: optionalBigintId,
    supervisorEmployeeId: optionalBigintId,
    employeeType: optionalEnum(EMPLOYEE_TYPES, "jenis karyawan"),
    canClockOutsideRadius: z.boolean().optional(),
    maritalStatus: optionalEnum(MARITAL_STATUSES, "status pernikahan"),
    employmentStatus: optionalEnum(EMPLOYMENT_STATUSES, "status karyawan"),
    recordStatus: optionalEnum(["draft", "active"] as const, "status data"),
    inPayroll: z.boolean().optional(),
    hourlyRate: z.preprocess((v) => {
      const n = blankToNull(v);
      if (n === null) return null;
      const num = typeof n === "number" ? n : Number(n);
      return Number.isFinite(num) ? num : n;
    }, z.number().nonnegative("Tarif tidak boleh negatif").nullable().optional()),
    dailyRate: z.preprocess((v) => {
      const n = blankToNull(v);
      if (n === null) return null;
      const num = typeof n === "number" ? n : Number(n);
      return Number.isFinite(num) ? num : n;
    }, z.number().nonnegative("Tarif tidak boleh negatif").nullable().optional()),
    email: z.preprocess(
      (v) => {
        const s = blankToNull(v);
        return typeof s === "string" ? s.trim().toLowerCase() : s;
      },
      z.email("Format email tidak valid").max(255, "Email terlalu panjang"),
    ),
    phone: z.preprocess(
      (v) => {
        const s = blankToNull(v);
        if (typeof s !== "string") return s;
        return s.replace(/[\s()-]/g, "");
      },
      z.string().regex(RE.phoneId, "Nomor HP tidak valid (contoh 08xxxxxxxxxx)").max(20).nullable().optional(),
    ),
    nik: z.preprocess(blankToNull, z.string().regex(RE.nik, "NIK wajib 16 digit angka").nullable().optional()),
    npwp: z.preprocess(
      (v) => {
        const s = blankToNull(v);
        return typeof s === "string" ? s.replace(/\D/g, "") : s;
      },
      z.string().regex(RE.npwp, "NPWP 15 atau 16 digit").nullable().optional(),
    ),
    bpjsKesehatanId: z.preprocess(
      (v) => {
        const s = blankToNull(v);
        return typeof s === "string" ? s.replace(/\D/g, "") : s;
      },
      z.string().regex(RE.bpjsKesehatan, "Nomor BPJS Kesehatan 13 digit").nullable().optional(),
    ),
    bpjsTkId: z.preprocess(
      (v) => {
        const s = blankToNull(v);
        return typeof s === "string" ? s.replace(/\D/g, "") : s;
      },
      z.string().regex(RE.bpjsTk, "Nomor BPJS Ketenagakerjaan 11 digit").nullable().optional(),
    ),
    taxStatus: optionalEnum(TAX_STATUSES, "status pajak"),
    bankName: optionalEnum(BANK_NAMES, "bank"),
    bankAccountNumber: z.preprocess(
      (v) => {
        const s = blankToNull(v);
        return typeof s === "string" ? s.replace(/\s+/g, "") : s;
      },
      z.string().regex(RE.bankAccount, "Nomor rekening 8–20 digit").nullable().optional(),
    ),
    bankAccountName: optionalName("Atas nama rekening"),
  });

function refineEmployeeWrite(
  d: z.infer<typeof employeeFields>,
  ctx: z.RefinementCtx,
) {
    const bankBits = [d.bankName, d.bankAccountNumber, d.bankAccountName].filter(Boolean).length;
    if (bankBits > 0 && bankBits < 3) {
      ctx.addIssue({
        code: "custom",
        message: "Bank, nomor rekening, dan atas nama harus diisi bersama",
        path: ["bankAccountNumber"],
      });
    }
    if (d.birthDate) {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (d.birthDate > iso) {
        ctx.addIssue({ code: "custom", message: "Tanggal lahir tidak boleh di masa depan", path: ["birthDate"] });
      }
    }
    if (d.birthDate && d.joinDate && d.joinDate < d.birthDate) {
      ctx.addIssue({ code: "custom", message: "Tanggal bergabung tidak boleh sebelum tanggal lahir", path: ["joinDate"] });
    }
    if (d.recordStatus === "active" && !(d.joinDate && d.positionId && d.payGroupId)) {
      ctx.addIssue({
        code: "custom",
        message: "Karyawan aktif wajib jabatan, kelompok gaji, dan tanggal bergabung",
        path: ["recordStatus"],
      });
    }
}

export const employeeWriteSchema = employeeFields.superRefine(refineEmployeeWrite);
export const employeePatchSchema = employeeFields.partial().superRefine((d, ctx) => {
  refineEmployeeWrite(d as z.infer<typeof employeeFields>, ctx);
});

export const educationSchema = z
  .object({
    educationId: optionalBigintId,
    level: z.enum(EDUCATION_LEVELS, { error: "Pilih jenjang yang valid" }),
    institution: z.preprocess(
      blankToNull,
      z.string({ error: "Institusi wajib diisi" }).min(2, "Institusi minimal 2 karakter").max(255),
    ),
    major: optionalText(120, "Jurusan"),
    startYear: optionalYear,
    endYear: optionalYear,
  })
  .superRefine((d, ctx) => {
    if (d.startYear && d.endYear && d.endYear < d.startYear) {
      ctx.addIssue({ code: "custom", message: "Tahun selesai tidak boleh sebelum tahun mulai", path: ["endYear"] });
    }
  });

export const familySchema = z.object({
  familyId: optionalBigintId,
  relation: z.enum(FAMILY_RELATIONS, { error: "Pilih hubungan keluarga yang valid" }),
  fullName: requiredName("Nama anggota keluarga"),
  birthDate: optionalIsoDate("Tanggal lahir"),
});

export const rankSchema = z.object({
  code: z.preprocess(blankToNull, z.string({ error: "Kode wajib" }).min(1).max(30).regex(/^[A-Za-z0-9._-]+$/, "Kode hanya huruf, angka, titik, atau strip")),
  name: z.preprocess(blankToNull, z.string({ error: "Nama wajib" }).min(1).max(120)),
  sortOrder: z.number().int().min(0).optional(),
});

export const salaryComponentAssignSchema = z.object({
  id: optionalBigintId,
  employeeId: requiredBigintId("Karyawan"),
  salaryComponentId: requiredBigintId("Komponen"),
  amount: moneyAmount,
  effectiveFrom: requiredIsoDate("Tanggal berlaku"),
  effectiveUntil: optionalIsoDate("Tanggal akhir"),
});

export const contractCreateSchema = z.object({
  stageOptionId: requiredBigintId("Tahap"),
  startDate: requiredIsoDate("Tanggal mulai"),
});

export const contractPatchSchema = z
  .object({
    contractId: requiredBigintId("Kontrak"),
    stageOptionId: optionalBigintId,
    startDate: optionalIsoDate("Tanggal mulai"),
    endDate: optionalIsoDate("Tanggal akhir"),
    status: optionalEnum(["active", "completed", "scheduled"] as const, "status kontrak"),
  })
  .superRefine((d, ctx) => {
    if (d.startDate && d.endDate && d.endDate < d.startDate) {
      ctx.addIssue({ code: "custom", message: "Tanggal akhir tidak boleh sebelum tanggal mulai", path: ["endDate"] });
    }
  });
