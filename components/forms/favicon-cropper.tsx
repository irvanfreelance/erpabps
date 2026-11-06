"use client";

import { useEffect, useRef, useState } from "react";

const OUT = 128;
const VIEW = 280;

export function FaviconCropper({
  imageSrc,
  onCancel,
  onConfirm,
  busy,
}: {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  busy?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [nw, setNw] = useState(1);
  const [nh, setNh] = useState(1);
  const [size, setSize] = useState(1);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      setNw(img.naturalWidth);
      setNh(img.naturalHeight);
      setSize(side);
      setOx((img.naturalWidth - side) / 2);
      setOy((img.naturalHeight - side) / 2);
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const scale = VIEW / Math.max(nw, nh, 1);
  const minSide = Math.min(nw, nh);
  const maxSize = minSide;

  function clamp(nextSize = size, nextOx = ox, nextOy = oy) {
    const s = Math.max(24, Math.min(maxSize, nextSize));
    const x = Math.max(0, Math.min(nw - s, nextOx));
    const y = Math.max(0, Math.min(nh - s, nextOy));
    setSize(s);
    setOx(x);
    setOy(y);
  }

  function confirm() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, ox, oy, size, size, 0, 0, OUT, OUT);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(new File([blob], "favicon.png", { type: "image/png" }));
      },
      "image/png",
      0.92,
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-xl bg-white p-4 sm:max-w-[360px] sm:rounded-xl">
        <h3 className="mt-0 mb-1 text-[16px] font-bold text-[var(--primary)]">Crop favicon dari logo</h3>
        <p className="mb-3 text-[12px] text-[#666]">Geser kotak, atur zoom, lalu pakai sebagai ikon tab.</p>
        <div
          className="relative mx-auto overflow-hidden rounded-xl bg-[#f0f0f0]"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox, oy };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = (e.clientX - drag.current.x) / scale;
            const dy = (e.clientY - drag.current.y) / scale;
            clamp(size, drag.current.ox - dx, drag.current.oy - dy);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {ready && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt=""
                draggable={false}
                className="pointer-events-none select-none"
                style={{
                  position: "absolute",
                  width: nw * scale,
                  height: nh * scale,
                  left: 0,
                  top: 0,
                }}
              />
              <div
                className="absolute box-border cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,.45)]"
                style={{
                  left: ox * scale,
                  top: oy * scale,
                  width: size * scale,
                  height: size * scale,
                }}
              />
            </>
          )}
        </div>
        <label className="mt-3 mb-3 flex items-center gap-2 text-[12px] text-[#666]">
          Zoom
          <input
            type="range"
            min={24}
            max={maxSize}
            value={size}
            className="flex-1"
            onChange={(e) => {
              const s = Number(e.target.value);
              clamp(s, ox + (size - s) / 2, oy + (size - s) / 2);
            }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-xl px-3 py-2 text-[13px]" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--primary)] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            onClick={confirm}
            disabled={!ready || busy}
          >
            {busy ? "Menyimpan…" : "Pakai sebagai favicon"}
          </button>
        </div>
      </div>
    </div>
  );
}
