import { DEFAULT_ORG } from "@/lib/nav";

export type OrgProfile = {
  id: number;
  nama: string;
  nama_singkat: string;
  tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  sidebar_color: string;
  accent_color: string;
  is_seed_default: boolean;
  updated_at?: string;
};

export function fallbackOrg(): OrgProfile {
  return {
    id: 1,
    nama: DEFAULT_ORG.nama,
    nama_singkat: DEFAULT_ORG.namaSingkat,
    tagline: DEFAULT_ORG.tagline,
    logo_url: DEFAULT_ORG.logoUrl,
    favicon_url: DEFAULT_ORG.faviconUrl,
    primary_color: DEFAULT_ORG.primaryColor,
    sidebar_color: DEFAULT_ORG.sidebarColor,
    accent_color: DEFAULT_ORG.accentColor,
    is_seed_default: true,
  };
}
