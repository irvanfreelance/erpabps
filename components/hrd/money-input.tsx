"use client";

import { inputClass } from "@/components/hrd/field";
import { formatMoneyDigits } from "@/lib/utils/format";

export function MoneyInput({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (digits: string) => void;
  name?: string;
}) {
  return (
    <div className={`${inputClass} flex items-center gap-2 pr-3`}>
      <span className="shrink-0 text-[13px] font-semibold text-[#5a5a5a]">Rp</span>
      <input
        className="min-w-0 flex-1 border-0 bg-transparent text-right tabular-nums outline-none"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={formatMoneyDigits(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
          onChange(digits);
        }}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
