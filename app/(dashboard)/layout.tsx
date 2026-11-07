import { redirect } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AppShell } from "@/components/layout/sidebar";
import { getServerSession } from "@/lib/auth/session";
import { GET as getOrgProfile } from "@/app/api/org-profile/route";
import { fromRoute } from "@/lib/api/from-route";
import { fallbackOrg, type OrgProfile } from "@/types/org";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  let org: OrgProfile;
  try {
    org = await fromRoute<OrgProfile>(await getOrgProfile());
  } catch {
    org = fallbackOrg();
  }
  return (
    <div
      style={
        {
          "--primary": org.primary_color,
          "--sidebar": org.sidebar_color,
          "--accent": org.accent_color,
        } as React.CSSProperties
      }
    >
      <AppShell userNama={session.user.nama} userEmail={session.user.email} userRole={session.user.role} org={org}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </AppShell>
    </div>
  );
}
