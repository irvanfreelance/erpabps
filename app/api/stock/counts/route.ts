import { postStockAction } from "@/lib/stock/handle";
import { postStockCount } from "@/lib/stock/posting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return postStockAction(req, "stock_counts", postStockCount);
}
