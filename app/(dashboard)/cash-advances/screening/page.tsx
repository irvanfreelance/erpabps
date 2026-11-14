import { redirect } from "next/navigation";
import { GET as list } from "@/app/api/cash-advances/route";
import { ScreeningTable } from "@/components/hrd/screening-table";
import { fromRoute } from "@/lib/api/from-route";
import { getServerSession } from "@/lib/auth/session";

export const metadata = { title: "Screening kasbon" };

export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (session.user.role !== "superadmin") redirect("/attendances/clock");

  const { rows } = await fromRoute<{
    rows: { id: string; full_name: string; amount: string; screening_status: string }[];
  }>(await list());
  return (
    <div>
      <h1 className="mb-3 mt-0 text-[20px] font-bold text-[var(--primary)]">Screening kasbon</h1>
      <ScreeningTable rows={rows} />
    </div>
  );
}
