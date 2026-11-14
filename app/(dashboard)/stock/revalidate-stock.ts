"use server";

import { revalidatePath } from "next/cache";

export async function revalidateStockPath(path: string) {
  if (!path.startsWith("/stock")) return;
  revalidatePath(path);
}
