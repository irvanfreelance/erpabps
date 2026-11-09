import { GET as list } from "@/app/api/bonus-pools/route";
import { GET as listGroups } from "@/app/api/pay-groups/route";
import {
  MonthlyBonusWorkspace,
  BonusPoolRow,
  BonusAllocRow,
} from "@/components/hrd/monthly-bonus-workspace";
import { fromRoute } from "@/lib/api/from-route";

export const metadata = { title: "Bonus Bulanan Berkomponen — ABPS" };

export default async function Page() {
  const [{ rows, allocations }, groupsData] = await Promise.all([
    fromRoute<{
      rows: BonusPoolRow[];
      allocations: BonusAllocRow[];
    }>(await list()),
    fromRoute<{
      rows: { id: string; name: string }[];
    }>(await listGroups()),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--primary)]">
          Bonus Tambahan Bulanan
        </h1>
        <p className="text-[13px] text-gray-500">
          Kelola pool dana bonus bulanan dan alokasi otomatis berdasarkan kedisiplinan keterlambatan, absensi izin, serta bagi rata sisa pool dana.
        </p>
      </div>

      <MonthlyBonusWorkspace
        pools={rows}
        allocations={allocations}
        payGroups={groupsData.rows}
      />
    </div>
  );
}
