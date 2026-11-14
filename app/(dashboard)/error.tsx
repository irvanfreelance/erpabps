"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string; status?: number };
  reset: () => void;
}) {
  const isForbidden =
    error.status === 403 ||
    error.message.toLowerCase().includes("forbidden") ||
    error.message.toLowerCase().includes("akses");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm max-w-md w-full space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {isForbidden ? "Akses Ditolak (403)" : "Terjadi Kesalahan"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isForbidden
            ? "Anda tidak memiliki izin untuk mengakses halaman ini."
            : error.message || "Halaman gagal dimuat."}
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            href="/attendances/clock"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Kembali ke Presensi
          </Link>
          {!isForbidden && (
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

