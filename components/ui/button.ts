/** Shared button metrics: 44px tall, 12px radius, 13px semibold. */
export const btn =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold !text-white disabled:opacity-40";

export const btnPrimary = `${btn} bg-[var(--primary)]`;

export const btnSecondary = `${btn} bg-[var(--accent)]`;

export const btnDanger = `${btn} bg-[#c24141]`;

export const btnDangerSm =
  "inline-flex min-h-8 items-center justify-center rounded-lg bg-[#c24141] px-2.5 text-[12px] font-semibold !text-white";

export const btnPrimarySm =
  "inline-flex min-h-8 items-center justify-center rounded-lg bg-[var(--primary)] px-2.5 text-[12px] font-semibold !text-white cursor-pointer";

export const btnSecondarySm =
  "inline-flex min-h-8 items-center justify-center rounded-lg bg-[var(--accent)] px-2.5 text-[12px] font-semibold !text-white cursor-pointer";

/** Full width on phones, hug content from the sm breakpoint. */
export const btnBlock = "w-full sm:w-auto";
