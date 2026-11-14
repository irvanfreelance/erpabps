import { postStockAction } from "@/lib/stock/handle";
import { postCashTopup } from "@/lib/stock/posting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return postStockAction(req, "cash_fund_entries", postCashTopup);
}
