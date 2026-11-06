"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FaviconCropper } from "@/components/forms/favicon-cropper";
import type { OrgProfile } from "@/types/org";

export function OrgSettingsForm({ org }: { org: OrgProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    nama: org.nama,
    namaSingkat: org.nama_singkat,
    tagline: org.tagline,
    logoUrl: org.logo_url ?? "",
    faviconUrl: org.favicon_url ?? "",
    primaryColor: org.primary_color,
    sidebarColor: org.sidebar_color,
    accentColor: org.accent_color,
  });
  const [saving, setSaving] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropBusy, setCropBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/org-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        logoUrl: form.logoUrl || null,
        faviconUrl: form.faviconUrl || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Gagal menyimpan pengaturan lembaga");
      return;
    }
    toast.success("Pengaturan lembaga tersimpan");
    router.refresh();
  }

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_220px]">
      <div className="rounded-[10px] bg-white p-5 shadow-sm">
        <h2 className="mt-0 mb-3 text-[16px] font-bold" style={{ color: form.primaryColor }}>
          Identitas lembaga
        </h2>
        <label className="mb-1 block text-[12px] text-[#666]">Nama lembaga</label>
        <input className="mb-3 min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={form.nama} onChange={(e) => set("nama", e.target.value)} />
        <label className="mb-1 block text-[12px] text-[#666]">Nama singkat</label>
        <input className="mb-3 min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={form.namaSingkat} onChange={(e) => set("namaSingkat", e.target.value)} />
        <label className="mb-1 block text-[12px] text-[#666]">Tagline</label>
        <input className="mb-3 min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
        <AssetField
          label="Logo lembaga"
          kind="logo"
          url={form.logoUrl}
          onUrl={(v) => set("logoUrl", v)}
          onUploaded={() => setCropOpen(true)}
        />
        <AssetField
          label="Favicon"
          kind="favicon"
          url={form.faviconUrl}
          fallbackUrl={form.logoUrl}
          onUrl={(v) => set("faviconUrl", v)}
          hint="Kosong = pakai logo. Atau crop dari logo utama."
        />
        {form.logoUrl && (
          <button
            type="button"
            className="mb-4 rounded-xl bg-[#e8e8e8] px-3 py-2 text-[12px] font-semibold"
            onClick={() => setCropOpen(true)}
          >
            Crop logo jadi favicon
          </button>
        )}
        {cropOpen && form.logoUrl && (
          <FaviconCropper
            imageSrc={`/api/org-profile/assets/source?kind=logo&t=${encodeURIComponent(form.logoUrl)}`}
            busy={cropBusy}
            onCancel={() => setCropOpen(false)}
            onConfirm={async (file) => {
              setCropBusy(true);
              const body = new FormData();
              body.set("kind", "favicon");
              body.set("file", file);
              const res = await fetch("/api/org-profile/assets", { method: "POST", body });
              const json = await res.json();
              setCropBusy(false);
              if (!res.ok) {
                toast.error(json.error || "Gagal menyimpan favicon");
                return;
              }
              set("faviconUrl", json.url);
              setCropOpen(false);
              toast.success("Favicon dari crop logo tersimpan");
              router.refresh();
            }}
          />
        )}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ColorField label="Utama" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} />
          <ColorField label="Sidebar" value={form.sidebarColor} onChange={(v) => set("sidebarColor", v)} />
          <ColorField label="Aksen" value={form.accentColor} onChange={(v) => set("accentColor", v)} />
        </div>
        <button
          className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: form.primaryColor }}
          disabled={saving}
          onClick={save}
        >
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
      <div className="overflow-hidden rounded-[10px] shadow-sm">
        <div className="p-4 text-white" style={{ background: form.sidebarColor }}>
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="" className="mb-2 h-7 max-w-[140px] object-contain" />
          ) : (
            <div className="text-[13px] font-bold">{form.namaSingkat}</div>
          )}
          <div className="text-[10px] opacity-70">{form.tagline}</div>
          <div className="mt-3 rounded bg-white/15 px-2 py-1.5 text-[12px] font-bold">Donatur</div>
          <div className="mt-1 px-2 py-1.5 text-[12px] opacity-80">Dashboard</div>
        </div>
        <div className="bg-white p-3 text-[12px]">
          <div className="font-bold" style={{ color: form.primaryColor }}>
            {form.nama}
          </div>
          <div className="mt-2 inline-block rounded-xl px-2 py-0.5 text-[11px] font-semibold" style={{ background: form.accentColor + "20", color: form.accentColor }}>
            Preview aksen
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetField({
  label,
  kind,
  url,
  fallbackUrl,
  onUrl,
  hint,
  onUploaded,
}: {
  label: string;
  kind: "logo" | "favicon";
  url: string;
  fallbackUrl?: string;
  onUrl: (v: string) => void;
  hint?: string;
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const preview = url || fallbackUrl || "";

  async function upload(file: File) {
    setBusy(true);
    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);
    const res = await fetch("/api/org-profile/assets", { method: "POST", body });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(json.error || "Unggah gagal");
      return;
    }
    onUrl(json.url);
    toast.success(kind === "logo" ? "Logo terunggah" : "Favicon terunggah");
    router.refresh();
    if (kind === "logo") onUploaded?.();
  }

  return (
    <div className="mb-3">
      <label className="mb-1 block text-[12px] text-[#666]">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-[#f8f9fa]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-[#aaa]">Kosong</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
            disabled={busy}
            className="w-full text-[12px]"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <input
            className="mt-1 min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 text-[13px]"
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="Atau tempel URL publik"
          />
          {hint && <div className="mt-0.5 text-[11px] text-[#888]">{hint}</div>}
          {busy && <div className="text-[11px] text-[var(--primary)]">Mengunggah ke penyimpanan…</div>}
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[12px] text-[#666]">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input className="min-h-10 w-full rounded-xl border border-[#ddd] bg-white px-3 font-mono text-[13px]" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}
