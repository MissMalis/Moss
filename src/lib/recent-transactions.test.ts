import { describe, expect, it } from "vitest";
import { groupByDate, type TransactionLike } from "./recent-transactions";

function tx(id: string, date: string, amount = 10): TransactionLike {
  return { id, name: id, amount, date, kind: "outflow", category: null };
}

describe("groupByDate", () => {
  it("buckets same-date items under one header, newest date first", () => {
    const groups = groupByDate([tx("a", "2026-08-01"), tx("b", "2026-08-03"), tx("c", "2026-08-01")]);
    expect(groups.map((g) => g.date)).toEqual(["2026-08-03", "2026-08-01"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("returns one group per item when every date is distinct", () => {
    const groups = groupByDate([tx("a", "2026-08-01"), tx("b", "2026-08-02")]);
    expect(groups).toHaveLength(2);
  });

  it("handles an empty list", () => {
    expect(groupByDate([])).toEqual([]);
  });
});
