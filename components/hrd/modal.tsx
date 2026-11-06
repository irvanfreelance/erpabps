"use client";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-auto rounded-t-2xl border-0 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl bg-[color-mix(in_srgb,var(--primary)_14%,white)] sm:max-w-lg sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="m-0 text-[16px] font-bold text-[var(--primary)]">{title}</h2>
          <button type="button" className="text-[13px] text-[#888]" onClick={onClose}>
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
