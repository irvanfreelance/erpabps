"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { btnPrimary, btnSecondary } from "@/components/ui/button";
import { monthDays, weekdayLabel } from "@/lib/hrd/schedule";

export type ScheduleEmployee = { id: string; full_name: string; location_id: string | null; location_name: string | null };
export type ScheduleTemplate = {
  id: string;
  code: string;
  name: string;
  shift_kind: string;
  start_time: string;
  end_time: string;
};
export type ScheduleRow = {
  id: string;
  employee_id: string;
  work_date: string;
  day_status: string;
  is_backup: boolean;
  notes: string | null;
  start_time: string | null;
  end_time: string | null;
  shift_template_id: string;
  shift_code: string;
  shift_name: string;
  template_start: string | null;
  template_end: string | null;
};

type PaletteCode = "P1" | "P2" | "MID" | "S3" | "BACKUP" | "OFF" | "OFF_IZIN" | "OFF_SAKIT" | "CUSTOM";

const PALETTE: { code: PaletteCode; label: string; className: string }[] = [
  { code: "P1", label: "Shift 1", className: "bg-emerald-100 text-emerald-900" },
  { code: "P2", label: "Shift 2", className: "bg-rose-100 text-rose-900" },
  { code: "MID", label: "Middle", className: "bg-sky-100 text-sky-900" },
  { code: "S3", label: "Shift 3", className: "bg-violet-100 text-violet-900" },
  { code: "BACKUP", label: "Backup", className: "bg-amber-100 text-amber-900" },
  { code: "CUSTOM", label: "Jam khusus", className: "bg-yellow-100 text-yellow-900" },
  { code: "OFF", label: "Off", className: "bg-red-200 text-red-950" },
  { code: "OFF_IZIN", label: "Izin", className: "bg-orange-200 text-orange-950" },
  { code: "OFF_SAKIT", label: "Sakit", className: "bg-orange-300 text-orange-950" },
];

function chipClass(row: ScheduleRow | null) {
  if (!row) return "bg-white";
  if (row.day_status === "off_izin") return "bg-orange-200 text-orange-950";
  if (row.day_status === "off_sakit") return "bg-orange-300 text-orange-950";
  if (row.day_status === "off") return "bg-red-200 text-red-950";
  const item = PALETTE.find((p) => p.code === row.shift_code);
  return item?.className ?? "bg-slate-100";
}

function cellTitle(row: ScheduleRow | null) {
  if (!row) return "";
  if (row.day_status === "off_izin") return "Izin";
  if (row.day_status === "off_sakit") return "Sakit";
  if (row.day_status === "off") return row.notes === "permintaan" ? "Off req" : "Off";
  if (row.shift_code === "CUSTOM" || (row.start_time && row.end_time)) return "Jam";
  if (row.shift_code === "P1") return "Shift 1";
  if (row.shift_code === "P2") return "Shift 2";
  if (row.shift_code === "MID") return "Middle";
  if (row.shift_code === "S3") return "Shift 3";
  if (row.shift_code === "BACKUP") return "Backup";
  return row.shift_name || row.shift_code;
}

function cellHours(row: ScheduleRow | null) {
  if (!row) return "";
  if (row.day_status !== "work") return "";
  const start = row.start_time || row.template_start;
  const end = row.end_time || row.template_end;
  if (!start || !end || (start === "00:00" && end === "00:00")) return "";
  return `${start}–${end}`;
}

function cellLabel(row: ScheduleRow | null) {
  const hours = cellHours(row);
  const title = cellTitle(row);
  if (!title) return "";
  return hours ? `${title} ${hours}` : title;
}

function weekGroups(days: { date: string; day: number; dow: number }[]) {
  const groups: { label: string; span: number }[] = [];
  let n = 1;
  let span = 0;
  for (let i = 0; i < days.length; i += 1) {
    span += 1;
    const nextMon = i + 1 < days.length && days[i + 1].dow === 1;
    if (nextMon || i === days.length - 1) {
      groups.push({ label: `Minggu ${n}`, span });
      n += 1;
      span = 0;
    }
  }
  return groups;
}

function PaletteChip({
  code,
  label,
  hours,
  className,
  disabled,
}: {
  code: PaletteCode;
  label: string;
  hours?: string;
  className: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${code}`, disabled });
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`min-h-8 rounded-lg px-2 py-1 text-left text-[12px] font-semibold leading-tight ${className} ${isDragging ? "opacity-50" : ""}`}
      disabled={disabled}
    >
      <span className="block">{label}</span>
      {hours ? <span className="block text-[10px] font-medium opacity-80">{hours}</span> : null}
    </button>
  );
}

function Cell({
  employeeId,
  date,
  row,
  canWrite,
  onOpen,
}: {
  employeeId: string;
  date: string;
  row: ScheduleRow | null;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const drop = useDroppable({ id: `cell:${employeeId}:${date}` });
  const drag = useDraggable({ id: `assign:${employeeId}:${date}`, disabled: !canWrite || !row });
  return (
    <td className="border border-[#eee] p-0.5 align-top">
      <div
        ref={(node) => {
          drop.setNodeRef(node);
          drag.setNodeRef(node);
        }}
        {...drag.listeners}
        {...drag.attributes}
        onClick={() => canWrite && onOpen()}
        className={`min-h-12 min-w-[4.5rem] cursor-pointer rounded-md px-1 py-1 text-center leading-tight ${chipClass(row)} ${drop.isOver ? "ring-2 ring-[var(--primary)]" : ""}`}
      >
        {row ? (
          <>
            <div className="text-[11px] font-semibold">{cellTitle(row)}</div>
            {cellHours(row) ? <div className="text-[10px] font-medium opacity-80">{cellHours(row)}</div> : null}
          </>
        ) : null}
      </div>
    </td>
  );
}

export function ScheduleBoard({
  month,
  locationId,
  locations,
  employees,
  rows,
  templates,
  canWrite,
}: {
  month: string;
  locationId: string;
  locations: { id: string; name: string }[];
  employees: ScheduleEmployee[];
  rows: ScheduleRow[];
  templates: ScheduleTemplate[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ employeeId: string; date: string } | null>(null);
  const [customStart, setCustomStart] = useState("08:00");
  const [customEnd, setCustomEnd] = useState("18:00");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const days = useMemo(() => monthDays(month), [month]);
  const weeks = useMemo(() => weekGroups(days), [days]);
  const hoursByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) {
      if (!t.start_time || !t.end_time || (t.start_time === "00:00" && t.end_time === "00:00")) continue;
      m.set(t.code, `${t.start_time}–${t.end_time}`);
    }
    return m;
  }, [templates]);
  const byKey = useMemo(() => {
    const m = new Map<string, ScheduleRow>();
    for (const r of rows) m.set(`${r.employee_id}:${r.work_date}`, r);
    return m;
  }, [rows]);

  function hrefFor(nextMonth: string, loc = locationId) {
    const q = new URLSearchParams({ month: nextMonth });
    if (loc) q.set("locationId", loc);
    return `/schedules?${q.toString()}`;
  }

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  async function assign(employeeId: string, workDate: string, code: PaletteCode, times?: { start: string; end: string }) {
    const dayStatus = code === "OFF" ? "off" : code === "OFF_IZIN" ? "off_izin" : code === "OFF_SAKIT" ? "off_sakit" : "work";
    const shiftCode = code === "OFF_IZIN" || code === "OFF_SAKIT" ? "OFF" : code;
    const body: Record<string, unknown> = { employeeId, workDate, shiftCode, dayStatus };
    if (code === "CUSTOM" || times) {
      body.shiftCode = "CUSTOM";
      body.startTime = times?.start ?? customStart;
      body.endTime = times?.end ?? customEnd;
    }
    const res = await fetch("/api/shift-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(typeof j.error === "string" ? j.error : "Gagal menyimpan");
      return;
    }
    const item = PALETTE.find((p) => p.code === code);
    const hours =
      code === "CUSTOM" || times
        ? `${times?.start ?? customStart}–${times?.end ?? customEnd}`
        : hoursByCode.get(shiftCode);
    toast.success(hours ? `${item?.label ?? code} ${hours} tersimpan` : `${item?.label ?? code} tersimpan`);
    router.refresh();
  }

  async function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id.startsWith("palette:")) {
      setActiveLabel(PALETTE.find((p) => p.code === id.slice(8))?.label ?? id.slice(8));
      return;
    }
    const [, emp, date] = id.split(":");
    setActiveLabel(cellLabel(byKey.get(`${emp}:${date}`) ?? null) || "geser");
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveLabel(null);
    if (!canWrite || !e.over) return;
    const over = String(e.over.id);
    if (!over.startsWith("cell:")) return;
    const [, toEmp, toDate] = over.split(":");
    const active = String(e.active.id);
    if (active.startsWith("palette:")) {
      await assign(toEmp, toDate, active.slice(8) as PaletteCode);
      return;
    }
    if (!active.startsWith("assign:")) return;
    const [, fromEmp, fromDate] = active.split(":");
    if (fromEmp === toEmp && fromDate === toDate) return;
    const res = await fetch("/api/shift-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        fromEmployeeId: fromEmp,
        fromDate,
        toEmployeeId: toEmp,
        toDate,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(typeof j.error === "string" ? j.error : "Gagal memindah");
      return;
    }
    const swapped = Boolean(byKey.get(`${toEmp}:${toDate}`));
    toast.success(swapped ? "Jadwal ditukar" : "Jadwal dipindah");
    router.refresh();
  }

  async function clearCell(employeeId: string, workDate: string) {
    const res = await fetch(`/api/shift-assignments?employeeId=${employeeId}&workDate=${workDate}`, { method: "DELETE" });
    if (!res.ok) toast.error("Gagal mengosongkan");
    else {
      toast.success("Jadwal dikosongkan");
      router.refresh();
    }
    setEditor(null);
  }

  async function onImport(file: File) {
    setImporting(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/shift-assignments/import", { method: "POST", body: fd });
    setImporting(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json.error === "string" ? json.error : "Impor gagal");
      return;
    }
    toast.success(`Tersimpan ${json.saved ?? 0} sel`);
    if (Array.isArray(json.errors) && json.errors.length) {
      toast.message(json.errors.slice(0, 4).map((e: { row: number; message: string }) => `Baris ${e.row}: ${e.message}`).join(" · "));
    }
    router.refresh();
  }

  const editorRow = editor ? byKey.get(`${editor.employeeId}:${editor.date}`) ?? null : null;
  const editorName = employees.find((e) => e.id === editor?.employeeId)?.full_name ?? "";

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <a className={`${btnSecondary} w-full md:w-auto`} href={hrefFor(shiftMonth(-1))}>
          Bulan sebelumnya
        </a>
        <span className="text-[14px] font-semibold">{month}</span>
        <a className={`${btnSecondary} w-full md:w-auto`} href={hrefFor(shiftMonth(1))}>
          Bulan berikutnya
        </a>
        <select
          className="min-h-10 rounded-xl border border-[#e8e8e8] px-3 text-[13px]"
          value={locationId}
          onChange={(e) => {
            window.location.href = hrefFor(month, e.target.value);
          }}
        >
          <option value="">Semua lokasi</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {canWrite ? (
          <>
            <a className={`${btnSecondary} w-full md:w-auto`} href={`/api/shift-assignments/import?month=${month}`}>
              Unduh template
            </a>
            <button type="button" className={`${btnPrimary} w-full md:w-auto`} disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? "Mengimpor…" : "Unggah Excel"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) onImport(f);
              }}
            />
          </>
        ) : null}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {canWrite ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {PALETTE.map((p) => (
              <PaletteChip
                key={p.code}
                {...p}
                hours={p.code === "CUSTOM" ? "isi jam" : hoursByCode.get(p.code === "OFF_IZIN" || p.code === "OFF_SAKIT" ? "OFF" : p.code)}
                disabled={!canWrite}
              />
            ))}
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-[#eee] bg-white">
          <table className="min-w-max border-collapse">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 z-10 border border-[#eee] bg-[#f8f8f8] px-3 text-left text-[12px]">
                  Nama
                </th>
                {weeks.map((w) => (
                  <th key={w.label} colSpan={w.span} className="border border-[#eee] bg-[#f3f7f6] px-2 text-[11px] font-semibold">
                    {w.label}
                  </th>
                ))}
              </tr>
              <tr>
                {days.map((d) => (
                  <th key={d.date} className="border border-[#eee] bg-[#fafafa] px-1 py-1 text-[11px] font-semibold">
                    <div>{d.day}</div>
                    <div className="font-normal text-[#888]">{weekdayLabel(d.dow)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <th className="sticky left-0 z-10 whitespace-nowrap border border-[#eee] bg-white px-3 text-left text-[13px] font-semibold">
                    {emp.full_name}
                  </th>
                  {days.map((d) => (
                    <Cell
                      key={d.date}
                      employeeId={emp.id}
                      date={d.date}
                      row={byKey.get(`${emp.id}:${d.date}`) ?? null}
                      canWrite={canWrite}
                      onOpen={() => {
                        setEditor({ employeeId: emp.id, date: d.date });
                        const cur = byKey.get(`${emp.id}:${d.date}`);
                        setCustomStart(cur?.start_time ?? "08:00");
                        setCustomEnd(cur?.end_time ?? "18:00");
                      }}
                    />
                  ))}
                </tr>
              ))}
              {!employees.length ? (
                <tr>
                  <td className="px-3 py-6 text-[13px] text-[#888]" colSpan={days.length + 1}>
                    Tidak ada crew outlet pada filter ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <DragOverlay>
          {activeLabel ? <div className="rounded-md bg-[var(--primary)] px-2 py-1 text-[12px] font-semibold text-white">{activeLabel}</div> : null}
        </DragOverlay>
      </DndContext>

      {editor && canWrite ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 md:items-center" onClick={() => setEditor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-[14px] font-semibold">
              {editorName} · {editor.date}
            </p>
            <p className="mb-2 text-[12px] text-[#888]">{editorRow ? cellLabel(editorRow) : "Kosong"}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {PALETTE.filter((p) => p.code !== "CUSTOM").map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className={`min-h-8 rounded-lg px-2 py-1 text-left text-[12px] font-semibold leading-tight ${p.className}`}
                  onClick={() => {
                    void assign(editor.employeeId, editor.date, p.code);
                    setEditor(null);
                  }}
                >
                  <span className="block">{p.label}</span>
                  {hoursByCode.get(p.code === "OFF_IZIN" || p.code === "OFF_SAKIT" ? "OFF" : p.code) ? (
                    <span className="block text-[10px] font-medium opacity-80">
                      {hoursByCode.get(p.code === "OFF_IZIN" || p.code === "OFF_SAKIT" ? "OFF" : p.code)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="min-h-10 rounded-xl border px-2" />
              <span>sampai</span>
              <input type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="min-h-10 rounded-xl border px-2" />
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  void assign(editor.employeeId, editor.date, "CUSTOM", { start: customStart, end: customEnd });
                  setEditor(null);
                }}
              >
                Simpan jam
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} onClick={() => clearCell(editor.employeeId, editor.date)}>
                Kosongkan
              </button>
              <button type="button" className={btnPrimary} onClick={() => setEditor(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <p className="mt-2 hidden text-[11px] text-[#888]">{templates.length} template</p>
    </div>
  );
}
