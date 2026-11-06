"use client";

import { useEffect, useState } from "react";
import { btnDanger, btnSecondary } from "@/components/ui/button";

type ConfirmState = {
  message: string;
  confirmLabel: string;
  resolve: (value: boolean) => void;
};

let pending: ConfirmState | null = null;
const listeners = new Set<(state: ConfirmState | null) => void>();

function emit(state: ConfirmState | null) {
  pending = state;
  listeners.forEach((fn) => fn(state));
}

export function confirmAction(message: string, confirmLabel = "Ya"): Promise<boolean> {
  return new Promise((resolve) => {
    emit({ message, confirmLabel, resolve });
  });
}

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmState | null>(pending);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  if (!state) return null;

  function close(value: boolean) {
    state?.resolve(value);
    emit(null);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-md" onClick={() => close(false)} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl bg-[color-mix(in_srgb,var(--primary)_16%,white)]">
        <p className="m-0 text-[15px] font-semibold text-[#1a1a1a]">{state.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={() => close(false)}>
            Batal
          </button>
          <button type="button" className={btnDanger} onClick={() => close(true)}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
