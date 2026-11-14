const HOURLY = new Set(["UPAH_JAM", "LEMBUR"]);
const DAILY = new Set(["UPAH_HARIAN", "INSENTIF_TGL_MERAH"]);
const PER_MINUTE = new Set(["POTONGAN_TELAT"]);

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

/** Qty × tarif untuk komponen jam/harian, termasuk saat hasilnya Rp0. */
export function componentQtyLabel(code: string, quantity: unknown, unitRate: unknown): string | null {
  const qty = Number(quantity);
  const rate = Number(unitRate);
  if (!Number.isFinite(qty) || !Number.isFinite(rate)) return null;

  if (HOURLY.has(code)) return `${qty} jam × ${rupiah(rate)}`;
  if (DAILY.has(code)) return `${qty} hari × ${rupiah(rate)}`;
  if (PER_MINUTE.has(code)) return `${qty} menit × ${rupiah(rate)}`;
  if (qty !== 1) return `${qty} × ${rupiah(rate)}`;
  return null;
}
