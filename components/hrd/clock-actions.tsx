"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, AlertCircle, Clock, CheckCircle2, Navigation } from "lucide-react";
import { calculateDistanceMeter } from "@/lib/utils/geo";

// Dynamic import untuk Leaflet map (client-only)
const AttendanceMap = dynamic(
  () => import("@/components/hrd/attendance-map").then((mod) => mod.AttendanceMap),
  { ssr: false, loading: () => <div className="h-[260px] w-full rounded-2xl bg-[#f0f0f0] animate-pulse" /> }
);

type TodayData = {
  employee: {
    id: string;
    full_name: string;
    employee_number: string | null;
    employee_type: string | null;
    can_clock_outside_radius: boolean;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    radius_meter: number;
  };
  attendance: {
    id: string;
    clock_in_at: string | null;
    clock_out_at: string | null;
    late_minutes: number;
    clock_in_status: string;
    outside_radius_note: string | null;
  } | null;
  assignment: {
    id: string;
    shift_code: string;
    shift_name: string;
    start_time: string | null;
    end_time: string | null;
  } | null;
  today: string;
};

export function ClockActions() {
  const router = useRouter();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");

  // Lokasi User
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Modal alasan luar radius
  const [showOutsideModal, setShowOutsideModal] = useState(false);
  const [outsideNote, setOutsideNote] = useState("");

  // Modal alasan telat
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const [pendingLateMinutes, setPendingLateMinutes] = useState<number>(0);

  // Clock interval (Asia/Jakarta WIB)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
      setCurrentDateStr(
        now.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "short",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data presensi hari ini
  const fetchData = async () => {
    try {
      const res = await fetch("/api/attendances/today");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal memuat status");
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data presensi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Watch posisi user saat ini
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation tidak didukung oleh perangkat/browser ini");
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoError(null);
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
        setGeoError("Tidak dapat mengakses GPS. Pastikan izin lokasi aktif.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  // Hitung jarak user ke lokasi kantor / outlet
  useEffect(() => {
    if (userCoords && data?.employee.location_lat != null && data?.employee.location_lng != null) {
      const dist = calculateDistanceMeter(
        userCoords.lat,
        userCoords.lng,
        Number(data.employee.location_lat),
        Number(data.employee.location_lng)
      );
      setDistance(dist);
    } else {
      setDistance(null);
    }
  }, [userCoords, data]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[14px] text-gray-500 animate-pulse">Memuat data presensi...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-600">
        Gagal memuat data karyawan untuk presensi.
      </div>
    );
  }

  const { employee, attendance, assignment } = data;
  const isClockedIn = Boolean(attendance?.clock_in_at);
  const isClockedOut = Boolean(attendance?.clock_out_at);

  const radiusMeter = employee.radius_meter || 100;
  const hasOfficeLoc = employee.location_lat != null && employee.location_lng != null;
  const isInsideRadius = !hasOfficeLoc || (distance != null && distance <= radiusMeter);
  const isOutside = hasOfficeLoc && distance != null && distance > radiusMeter;

  async function handlePunch(kind: "in" | "out", note?: string, lateRsn?: string) {
    if (submitting) return;

    if (kind === "in" && isOutside) {
      if (!employee.can_clock_outside_radius) {
        toast.error(`Anda berada di luar radius (${distance}m, maks ${radiusMeter}m). Presensi ditolak.`);
        return;
      }
      if (!note) {
        setShowOutsideModal(true);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          lat: userCoords?.lat,
          lng: userCoords?.lng,
          outsideRadiusNote: note,
          lateReason: lateRsn,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.isLate && !lateRsn) {
          setPendingLateMinutes(json.lateMinutes || 0);
          setShowLateModal(true);
          return;
        }
        toast.error(typeof json.error === "string" ? json.error : "Gagal mencatat presensi");
        return;
      }

      toast.success(kind === "in" ? "Berhasil Clock-in!" : "Berhasil Clock-out!");
      setShowOutsideModal(false);
      setShowLateModal(false);
      setOutsideNote("");
      setLateReason("");
      await fetchData();
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  // Format Jam Masuk / Keluar (Asia/Jakarta WIB)
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    return d.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="mx-auto max-w-md pb-12">
      {/* Title Card */}
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm text-center border border-gray-100">
        <h2 className="text-[17px] font-semibold text-gray-800">Kehadiran Langsung</h2>
        <p className="text-[12px] text-gray-500 mt-0.5">
          {employee.location_name ? `Lokasi: ${employee.location_name}` : "Lokasi belum disetel"}
        </p>
      </div>

      {/* Main Clock Card */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
        {/* Real-time Clock Display */}
        <div className="text-center my-1">
          <div className="text-[36px] font-extrabold tracking-tight text-gray-900">
            {currentTime || "--:--:--"}
          </div>
          <div className="text-[13px] text-gray-500 mt-0.5 font-medium">
            {currentDateStr || "Memuat tanggal..."}
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2 my-5">
          <div className="rounded-xl bg-[#eef4ff] p-3 text-center">
            <span className="block text-[11px] font-medium text-gray-500">Masuk</span>
            <span className="block text-[14px] font-bold text-[#2563eb] mt-0.5">
              {formatTime(attendance?.clock_in_at)}
            </span>
          </div>
          <div className="rounded-xl bg-[#eef4ff] p-3 text-center">
            <span className="block text-[11px] font-medium text-gray-500">Keluar</span>
            <span className="block text-[14px] font-bold text-[#2563eb] mt-0.5">
              {formatTime(attendance?.clock_out_at)}
            </span>
          </div>
          <div className="rounded-xl bg-[#eef4ff] p-3 text-center">
            <span className="block text-[11px] font-medium text-gray-500">Terlambat</span>
            <span className={`block text-[14px] font-bold mt-0.5 ${attendance?.late_minutes && attendance.late_minutes > 0 ? "text-red-500" : "text-[#2563eb]"}`}>
              {attendance?.late_minutes && attendance.late_minutes > 0 ? `${attendance.late_minutes}m` : "-"}
            </span>
          </div>
        </div>

        {/* Interactive Map */}
        <div className="relative mb-4">
          <AttendanceMap
            userLat={userCoords?.lat ?? null}
            userLng={userCoords?.lng ?? null}
            locLat={employee.location_lat != null ? Number(employee.location_lat) : null}
            locLng={employee.location_lng != null ? Number(employee.location_lng) : null}
            radiusMeter={radiusMeter}
          />

          {/* Badge Status Radius di atas peta */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            {distance != null ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-md ${
                  isInsideRadius
                    ? "bg-emerald-500/90 text-white"
                    : "bg-amber-500/90 text-white"
                }`}
              >
                <Navigation className="h-3 w-3" />
                {distance}m dari titik ({isInsideRadius ? "Di dalam radius" : "Di luar radius"})
              </span>
            ) : geoError ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                <AlertCircle className="h-3 w-3" /> GPS tidak aktif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-600/80 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                Mencari sinyal GPS...
              </span>
            )}
          </div>
        </div>

        {/* Schedule Info */}
        <div className="text-center my-4">
          <p className="text-[11px] text-gray-400">Jadwal, {currentDateStr}</p>
          <p className="text-[14px] font-bold text-gray-800 mt-0.5">
            {assignment?.shift_name || (employee.employee_type === "dapur" ? "Dapur (Upah per jam)" : "Reguler Schedule")}
          </p>
          <p className="text-[15px] font-semibold text-gray-700">
            {assignment?.start_time && assignment?.end_time
              ? `${assignment.start_time.slice(0, 5)} - ${assignment.end_time.slice(0, 5)}`
              : employee.employee_type === "dapur"
                ? "Fleksibel"
                : "08:00 - 17:00"}
          </p>
        </div>

        {/* Warning jika luar radius tapi punya izin khusus */}
        {isOutside && !isClockedIn && employee.can_clock_outside_radius && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-800 border border-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Anda berada di luar radius kantor ({distance}m). Anda memiliki izin absen luar radius. Wajib menyertakan alasan keterangan.
            </span>
          </div>
        )}

        {/* Action Button: Hijau (Masuk) -> Merah (Pulang) -> Disabled (Selesai) */}
        <div className="mt-2">
          {!isClockedIn ? (
            <button
              type="button"
              disabled={submitting || (isOutside && !employee.can_clock_outside_radius)}
              onClick={() => handlePunch("in")}
              className={`w-full rounded-2xl py-3.5 text-[15px] font-bold text-white shadow-md transition-all active:scale-[0.99] ${
                isOutside && !employee.can_clock_outside_radius
                  ? "bg-gray-300 cursor-not-allowed text-gray-500 shadow-none"
                  : "bg-[#10b981] hover:bg-[#059669] shadow-emerald-500/25"
              }`}
            >
              {submitting
                ? "Memproses..."
                : isOutside && !employee.can_clock_outside_radius
                  ? "Di Luar Radius Presensi"
                  : isOutside && employee.can_clock_outside_radius
                    ? "Clock In (Luar Radius)"
                    : "Clock In"}
            </button>
          ) : !isClockedOut ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handlePunch("out")}
              className="w-full rounded-2xl bg-[#ef4444] py-3.5 text-[15px] font-bold text-white shadow-md shadow-red-500/25 hover:bg-[#dc2626] transition-all active:scale-[0.99]"
            >
              {submitting ? "Memproses..." : "Clock Out"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full rounded-2xl bg-gray-200 py-3.5 text-[15px] font-bold text-gray-500 cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Presensi Hari Ini Selesai
            </button>
          )}
        </div>
      </div>

      {/* Modal Keterangan Presensi Luar Radius */}
      {showOutsideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-[16px] font-bold text-gray-800">Alasan di Luar Radius</h3>
            <p className="mt-1 text-[13px] text-gray-500">
              Jarak Anda {distance}m dari lokasi ({radiusMeter}m). Mohon berikan keterangan alasan mengapa absen di luar radius:
            </p>
            <textarea
              rows={3}
              className="mt-3 w-full rounded-xl border border-gray-300 p-2.5 text-[13px] focus:border-[var(--primary)] focus:outline-none"
              placeholder="Contoh: Sedang bertugas belanja bahan di pasar, survei lapangan, dsb..."
              value={outsideNote}
              onChange={(e) => setOutsideNote(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowOutsideModal(false)}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || !outsideNote.trim()}
                onClick={() => handlePunch("in", outsideNote, lateReason)}
                className="flex-1 rounded-xl bg-[#10b981] py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#059669] disabled:bg-gray-300"
              >
                {submitting ? "Menyimpan..." : "Kirim Clock In"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Keterangan Alasan Telat */}
      {showLateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-[16px] font-bold text-gray-900">Keterangan Terlambat</h3>
            </div>
            <p className="mt-1.5 text-[13px] text-gray-600">
              Anda terdeteksi terlambat <span className="font-bold text-red-600">{pendingLateMinutes} menit</span>. Mohon isi alasan keterlambatan kehadiran Anda:
            </p>
            <textarea
              rows={3}
              className="mt-3 w-full rounded-xl border border-gray-300 p-2.5 text-[13px] focus:border-[var(--primary)] focus:outline-none"
              placeholder="Contoh: Macet di jalan tol, ban motor bocor, cuaca hujan lebat, dsb..."
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLateModal(false)}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || !lateReason.trim()}
                onClick={() => handlePunch("in", outsideNote, lateReason)}
                className="flex-1 rounded-xl bg-[#10b981] py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#059669] disabled:bg-gray-300"
              >
                {submitting ? "Menyimpan..." : "Konfirmasi & Hadir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
