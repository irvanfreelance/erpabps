import { GET as list } from "@/app/api/cash-advances/route";
import { ScreeningTable } from "@/components/hrd/screening-table";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Screening kasbon" };

export default async function Page() {
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
