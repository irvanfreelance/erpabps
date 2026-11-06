/** Shared button metrics: 44px tall, 12px radius, 13px semibold. */
export const btn =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-40";

export const btnPrimary = `${btn} bg-[var(--primary)] text-white`;

export const btnSecondary = `${btn} border border-[#ddd] bg-white text-[#333]`;

/** Full width on phones, hug content from the sm breakpoint. */
export const btnBlock = "w-full sm:w-auto";
