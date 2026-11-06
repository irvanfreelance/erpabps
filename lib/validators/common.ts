import { z } from "zod";

export const RE = {
  isoDate: /^\d{4}-\d{2}-\d{2}$/,
  employeeNumber: /^CW\d{3}$/,
  nik: /^(?!0{16})\d{16}$/,
  phoneId: /^(?:\+62|62|0)8[1-9][0-9]{6,11}$/,
  bankAccount: /^(?!0+$)\d{8,20}$/,
  npwp: /^(?!0+$)\d{15,16}$/,
  bpjsKesehatan: /^(?!0+$)\d{13}$/,
  bpjsTk: /^(?!0+$)\d{11}$/,
  personName: /^[\p{L}\p{M}][\p{L}\p{M} .,'()-]{0,253}[\p{L}\p{M}.]$/u,
  bigintId: /^\d+$/,
} as const;

export function blankToNull(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return typeof value === "string" ? value.trim() : value;
}

export function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Data tidak valid";
}

function isCalendarDate(value: string) {
  if (!RE.isoDate.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const optionalText = (max: number, label: string) =>
  z.preprocess(
    blankToNull,
    z.string().max(max, `${label} maksimal ${max} karakter`).nullable().optional(),
  );

export const requiredName = (label: string, max = 255) =>
  z.preprocess(
    blankToNull,
    z
      .string({ error: `${label} wajib diisi` })
      .min(2, `${label} minimal 2 karakter`)
      .max(max, `${label} maksimal ${max} karakter`)
      .regex(RE.personName, `${label} hanya huruf, spasi, dan tanda baca nama`),
  );

export const optionalName = (label: string, max = 255) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .min(2, `${label} minimal 2 karakter`)
      .max(max, `${label} maksimal ${max} karakter`)
      .regex(RE.personName, `${label} hanya huruf, spasi, dan tanda baca nama`)
      .nullable()
      .optional(),
  );

export const optionalIsoDate = (label: string) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .regex(RE.isoDate, `${label} harus YYYY-MM-DD`)
      .refine(isCalendarDate, `${label} tidak valid`)
      .nullable()
      .optional(),
  );

export const requiredIsoDate = (label: string) =>
  z.preprocess(
    blankToNull,
    z
      .string({ error: `${label} wajib diisi` })
      .regex(RE.isoDate, `${label} harus YYYY-MM-DD`)
      .refine(isCalendarDate, `${label} tidak valid`),
  );

export const optionalBigintId = z.preprocess(
  blankToNull,
  z.string().regex(RE.bigintId, "ID tidak valid").nullable().optional(),
);

export const requiredBigintId = (label: string) =>
  z.preprocess(
    blankToNull,
    z.string({ error: `${label} wajib dipilih` }).regex(RE.bigintId, `${label} tidak valid`),
  );

export const optionalYear = z.preprocess((value) => {
  const v = blankToNull(value);
  if (v === null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : v;
}, z.number().int("Tahun harus bilangan bulat").min(1950, "Tahun minimal 1950").max(2100, "Tahun maksimal 2100").nullable().optional());

export const moneyAmount = z.preprocess((value) => {
  const v = blankToNull(value);
  if (v === null) return v;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : v;
}, z.number({ error: "Nominal wajib diisi" }).finite().positive("Nominal harus lebih dari 0").max(99_999_999_999, "Nominal terlalu besar"));
