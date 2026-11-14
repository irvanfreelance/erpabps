export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundQty(value: number) {
  return Math.round((value + Number.EPSILON) * 1e6) / 1e6;
}

export function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type CostMethod = "moving_average" | "fifo";
export type FreightMethod = "by_value" | "by_qty" | "none";

export type AllocInput = { item_id: number; qty: number; goods_value: number };
export type AllocLine = AllocInput & {
  allocated_extra: number;
  all_in_value: number;
  unit_cost: number;
};

/** Ongkir/biaya lain. Baris terakhir menyerap selisih pembulatan. */
export function allocateExtra(lines: AllocInput[], extra: number, method: FreightMethod): AllocLine[] {
  const totalExtra = method === "none" ? 0 : roundMoney(Math.max(0, extra));
  const base =
    method === "by_qty"
      ? lines.reduce((sum, line) => sum + line.qty, 0)
      : lines.reduce((sum, line) => sum + line.goods_value, 0);
  let remaining = totalExtra;

  return lines.map((line, index) => {
    let allocated = 0;
    if (method !== "none" && base > 0) {
      if (index === lines.length - 1) {
        allocated = remaining;
      } else {
        const weight = method === "by_qty" ? line.qty : line.goods_value;
        allocated = roundMoney((totalExtra * weight) / base);
        remaining = roundMoney(remaining - allocated);
      }
    }
    const allIn = roundMoney(line.goods_value + allocated);
    const unit = line.qty > 0 ? roundQty(allIn / line.qty) : 0;
    return { ...line, allocated_extra: allocated, all_in_value: allIn, unit_cost: unit };
  });
}

export type Layer = { qty: number; value: number };

export function replayLayers(
  moves: Array<{ move_kind: string; qty: number; value: number }>,
): Layer[] {
  const layers: Layer[] = [];
  const add = (qty: number, value: number) => {
    if (qty > 1e-9) layers.push({ qty: roundQty(qty), value: roundMoney(value) });
  };
  const consume = (qty: number) => {
    let left = qty;
    for (const layer of layers) {
      if (left <= 1e-9) break;
      const take = Math.min(layer.qty, left);
      const part = layer.qty > 0 ? (layer.value * take) / layer.qty : 0;
      layer.qty = roundQty(layer.qty - take);
      layer.value = roundMoney(layer.value - part);
      left = roundQty(left - take);
    }
  };

  for (const move of moves) {
    const qty = asNumber(move.qty);
    const value = asNumber(move.value);
    if (move.move_kind === "receipt" || move.move_kind === "produce") add(qty, value);
    else if (move.move_kind === "consume" || move.move_kind === "ship") consume(qty);
    else if (qty >= 0) add(qty, value);
    else consume(-qty);
  }
  return layers.filter((layer) => layer.qty > 1e-9);
}

export function fifoIssueValue(layers: Layer[], qty: number) {
  let left = qty;
  let value = 0;
  for (const layer of layers) {
    if (left <= 1e-9) break;
    const take = Math.min(layer.qty, left);
    value += layer.qty > 0 ? (layer.value * take) / layer.qty : 0;
    left -= take;
  }
  return roundMoney(value);
}

/** Nilai keluar. Sisa terakhir mengambil seluruh nilai agar tidak ada selisih sen. */
export function movingAverageIssueValue(qtyOnHand: number, valueOnHand: number, qty: number) {
  if (qty <= 0) return 0;
  if (qtyOnHand <= 1e-9) return 0;
  if (qty >= qtyOnHand - 1e-9) return roundMoney(valueOnHand);
  return roundMoney((valueOnHand * qty) / qtyOnHand);
}
