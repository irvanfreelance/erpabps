"use client";

export function Modal({
  title,
  onClose,
  children,
  maxWidth = "sm:max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Tutup" onClick={onClose} />
      <div className={`relative z-10 max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-gray-100 bg-white p-5 shadow-[0_20px_40px_rgba(0,0,0,0.15)] sm:rounded-2xl sm:p-6 ${maxWidth}`}>
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <h2 className="m-0 text-[16px] font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
