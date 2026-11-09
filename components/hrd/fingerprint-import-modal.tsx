"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/hrd/modal";
import { btnPrimary, btnSecondary } from "@/components/ui/button";

export function FingerprintImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<{
    successCount: number;
    errors: string[];
  } | null>(null);

  async function handleDownloadTemplate(filterType?: string) {
    try {
      setDownloading(true);
      const url = filterType
        ? `/api/attendances/fingerprint-import?type=${filterType}`
        : "/api/attendances/fingerprint-import";

      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal mengunduh template Excel");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Template_Import_Fingerprint_${filterType ? filterType.toUpperCase() : "SEMUA"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Template Excel dengan data riil karyawan berhasil diunduh");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Pilih file Excel yang ingin diunggah");
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/attendances/fingerprint-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengimport data fingerprint");

      setResult({
        successCount: data.successCount,
        errors: data.errors || [],
      });

      toast.success(`Berhasil mengimpor ${data.successCount} rekaman presensi fingerprint!`);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengimpor file");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      title="Import Presensi Mesin Fingerprint (Crew Dapur & Outlet)"
      onClose={onClose}
      maxWidth="sm:max-w-xl"
    >
      <div className="space-y-4 text-[13px]">
        {/* Banner Penjelasan */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-emerald-900">
          <p className="font-semibold">Bantuan Import Presensi Karyawan Sepuh / Dapur</p>
          <p className="mt-1 text-[12px] text-emerald-800">
            Untuk karyawan dapur yang kesulitan presensi via ponsel pintar, HR Superadmin dapat mengunduh template siap pakai dengan nama &amp; nomor karyawan riil, mengisi log jam masuk/pulang dari mesin fingerprint, lalu mengunggahnya kembali ke sistem.
          </p>
        </div>

        {/* Step 1: Download Template */}
        <div className="rounded-xl border border-gray-200 p-4 space-y-2.5 bg-gray-50/40">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">
              Langkah 1: Unduh Template Excel
            </span>
            <FileSpreadsheet className="h-4 w-4 text-[var(--primary)]" />
          </div>
          <p className="text-[12px] text-gray-500">
            Pilih template yang sudah terisi otomatis dengan nama dan nomor karyawan riil dari database:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={downloading}
              onClick={() => handleDownloadTemplate("dapur")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all shadow-sm disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Khusus Karyawan Dapur (.xlsx)
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={() => handleDownloadTemplate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Semua Karyawan (.xlsx)
            </button>
          </div>
        </div>

        {/* Step 2: Upload File Form */}
        <form onSubmit={handleUpload} className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-gray-800 uppercase tracking-wider">
              Langkah 2: Unggah Berkas Presensi
            </span>
            <Upload className="h-4 w-4 text-emerald-600" />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1">
              Pilih Berkas Excel (.xlsx) Hasil Log Fingerprint
            </label>
            <input
              type="file"
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-[13px] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              required
            />
          </div>

          {result && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50 text-[12px]">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>{result.successCount} rekaman presensi berhasil disimpan!</span>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-gray-200 text-rose-600">
                  <div className="flex items-center gap-1 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Catatan / Kesalahan ({result.errors.length}):</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] max-h-28 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              className={btnSecondary}
              onClick={onClose}
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className={btnPrimary}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Mengimpor...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Proses &amp; Simpan Presensi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

