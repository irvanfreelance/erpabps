export const inputClass =
  "min-h-11 w-full rounded-2xl border border-[#e8e8e8] bg-white px-3 text-[13px] outline-none";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`block min-w-0 ${className}`}>
      <span className="mb-0.5 block text-[12px] font-semibold tracking-wide text-[#5a5a5a]">{label}</span>
      <span className="mb-1.5 block min-h-[1.1rem] text-[11px] leading-snug text-[#8a8a8a]">{hint || "\u00a0"}</span>
      {children}
    </div>
  );
}

export const formCard =
  "rounded-2xl border-0 p-4 md:p-8 backdrop-blur-xl bg-[color-mix(in_srgb,var(--primary)_14%,white)]";
