import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/login-screen";
import { GET as getOrgProfile } from "@/app/api/org-profile/route";
import { fromRoute } from "@/lib/api/from-route";
import { fallbackOrg, type OrgProfile } from "@/types/org";

export async function generateMetadata(): Promise<Metadata> {
  let org: OrgProfile;
  try {
    org = await fromRoute<OrgProfile>(await getOrgProfile());
  } catch {
    org = fallbackOrg();
  }
  const brand = org.nama_singkat || org.nama;
  return {
    title: `Masuk — ${brand}`,
    description: `Masuk ke sistem ${org.nama}`,
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const q = await searchParams;
  let org: OrgProfile;
  try {
    org = await fromRoute<OrgProfile>(await getOrgProfile());
  } catch {
    org = fallbackOrg();
  }
  return <LoginScreen org={org} denied={Boolean(q.error)} />;
}
