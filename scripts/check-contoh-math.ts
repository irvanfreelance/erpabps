import assert from "node:assert/strict";
import {
  allocateExtra,
  movingAverageIssueValue,
  roundMoney,
} from "../lib/stock/money";

const lines = allocateExtra(
  [
    { item_id: 1, qty: 20, goods_value: 600_000 },
    { item_id: 2, qty: 2, goods_value: 40_000 },
  ],
  32_000,
  "by_value",
);
assert.deepEqual(
  lines.map((line) => line.all_in_value),
  [630_000, 42_000],
);
assert.equal(lines[0].unit_cost, 31_500);
assert.equal(lines[1].unit_cost, 21_000);
assert.equal(
  roundMoney(lines.reduce((sum, line) => sum + line.all_in_value, 0)),
  672_000,
);

const ayamOut = movingAverageIssueValue(20, 630_000, 12);
const bumbuOut = movingAverageIssueValue(2, 42_000, 0.4);
assert.equal(ayamOut, 378_000);
assert.equal(bumbuOut, 8_400);
const ungkep = roundMoney(ayamOut + bumbuOut);
assert.equal(ungkep, 386_400);
assert.equal(roundMoney(ungkep / 10), 38_640);

const shipOut = movingAverageIssueValue(10, ungkep, 4);
const remainValue = roundMoney(ungkep - shipOut);
const shipCat = movingAverageIssueValue(6, remainValue, 3);
assert.equal(shipOut, 154_560);
assert.equal(shipCat, 115_920);
const stockLeft = roundMoney(672_000 - shipOut - shipCat);
assert.equal(stockLeft, 401_520);

const priceOut = roundMoney(4 * 38_640 * 1.2);
const priceCat = roundMoney(3 * 38_640 * 1.3);
assert.equal(priceOut, 185_472);
assert.equal(priceCat, 150_696);
assert.equal(roundMoney(priceOut - shipOut + (priceCat - shipCat)), 65_688);

console.log("CONTOH math ok", { stockLeft, profit: 65_688 });
