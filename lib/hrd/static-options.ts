export const GENDERS = ["male", "female"] as const;
export const MARITAL_STATUSES = ["unmarried", "married", "divorced", "widowed"] as const;
export const EMPLOYMENT_STATUSES = ["permanent", "contract", "training"] as const;
export const EDUCATION_LEVELS = ["SD", "SMP", "SMA", "SMK", "D1", "D2", "D3", "S1", "S2", "S3"] as const;
export const FAMILY_RELATIONS = ["husband", "wife", "child", "father", "mother", "sibling", "guardian"] as const;
export const EMPLOYEE_TYPES = ["outlet", "dapur", "office"] as const;

export const EMPLOYEE_TYPE_OPTIONS = [
  { value: "outlet", label: "Crew Outlet" },
  { value: "dapur", label: "Crew Dapur" },
  { value: "office", label: "Office" },
];

export const MARITAL_OPTIONS = [
  { value: "unmarried", label: "Belum menikah" },
  { value: "married", label: "Menikah" },
  { value: "divorced", label: "Cerai hidup" },
  { value: "widowed", label: "Cerai mati" },
];

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "permanent", label: "Tetap" },
  { value: "contract", label: "Kontrak" },
  { value: "training", label: "Training" },
];

const EDUCATION_LABELS: Record<(typeof EDUCATION_LEVELS)[number], string> = {
  SD: "SD",
  SMP: "SMP",
  SMA: "SMA/SMK",
  SMK: "SMK",
  D1: "D1",
  D2: "D2",
  D3: "D3",
  S1: "S1",
  S2: "S2",
  S3: "S3",
};

export const EDUCATION_LEVEL_OPTIONS = EDUCATION_LEVELS.map((id) => ({ id, name: EDUCATION_LABELS[id] }));

export const BANK_NAMES = [
  "Muamalat",
  "BSI",
  "BSN",
  "BJB",
  "BCA",
  "Mandiri",
  "BRI",
  "BNI",
  "BTN",
  "CIMB Niaga",
  "Permata",
  "Danamon",
  "Panin",
] as const;

export const BANK_OPTIONS = BANK_NAMES.map((name) => ({ value: name, label: name }));

export const TAX_STATUSES = [
  "TK0",
  "TK1",
  "TK2",
  "TK3",
  "K0",
  "K1",
  "K2",
  "K3",
  "KI0",
  "KI1",
  "KI2",
  "KI3",
  "HB0",
] as const;

export const TAX_STATUS_OPTIONS = [
  { value: "TK0", label: "TK/0 — Tidak kawin, 0 tanggungan" },
  { value: "TK1", label: "TK/1 — Tidak kawin, 1 tanggungan" },
  { value: "TK2", label: "TK/2 — Tidak kawin, 2 tanggungan" },
  { value: "TK3", label: "TK/3 — Tidak kawin, 3 tanggungan" },
  { value: "K0", label: "K/0 — Kawin, 0 tanggungan" },
  { value: "K1", label: "K/1 — Kawin, 1 tanggungan" },
  { value: "K2", label: "K/2 — Kawin, 2 tanggungan" },
  { value: "K3", label: "K/3 — Kawin, 3 tanggungan" },
  { value: "KI0", label: "K/I/0 — Kawin, penghasilan istri digabung, 0 tanggungan" },
  { value: "KI1", label: "K/I/1 — Kawin, penghasilan istri digabung, 1 tanggungan" },
  { value: "KI2", label: "K/I/2 — Kawin, penghasilan istri digabung, 2 tanggungan" },
  { value: "KI3", label: "K/I/3 — Kawin, penghasilan istri digabung, 3 tanggungan" },
  { value: "HB0", label: "HB/0 — Hidup berpisah" },
];

export const FAMILY_RELATION_OPTIONS = [
  { id: "husband", name: "Suami" },
  { id: "wife", name: "Istri" },
  { id: "child", name: "Anak" },
  { id: "father", name: "Ayah" },
  { id: "mother", name: "Ibu" },
  { id: "sibling", name: "Saudara" },
  { id: "guardian", name: "Wali" },
];
