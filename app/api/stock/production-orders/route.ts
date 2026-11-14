import { postStockAction } from "@/lib/stock/handle";
import { postProduction } from "@/lib/stock/posting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return postStockAction(req, "production_orders", postProduction);
}
