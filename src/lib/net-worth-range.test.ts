import { describe, expect, it } from "vitest";
import { computeDeltas, filterByRange } from "./net-worth-range";
import type { HistoryPoint } from "./net-worth";

function pt(date: string, contributed: number, marketValue: number): HistoryPoint {
  return { date, contributed, marketValue };
}

const twelveMonths: HistoryPoint[] = Array.from({ length: 12 }, (_, i) => {
  const month = String(i + 1).padStart(2, "0");
  return pt(`2026-${month}-01`, 1000 * (i + 1), 1000 * (i + 1) + i * 50);
});

describe("filterByRange", () => {
  it("ALL returns every point untouched", () => {
    expect(filterByRange(twelveMonths, "ALL")).toHaveLength(12);
  });

  it("3M keeps roughly the last 3 months relative to the latest point", () => {
    const filtered = filterByRange(twelveMonths, "3M");
    expect(filtered[0].date >= "2026-09-01").toBe(true);
    expect(filtered[filtered.length - 1].date).toBe("2026-12-01");
  });

  it("handles an empty series", () => {
    expect(filterByRange([], "6M")).toEqual([]);
  });
});

describe("computeDeltas", () => {
  it("all-time % is growth over total contributed, independent of range", () => {
    const delta = computeDeltas(twelveMonths, filterByRange(twelveMonths, "3M"))!;
    const last = twelveMonths[11];
    const expectedPct = ((last.marketValue - last.contributed) / last.contributed) * 100;
    expect(delta.allTimePct).toBeCloseTo(expectedPct, 5);
  });

  it("range delta is the market-value move within just the selected range", () => {
    const range = filterByRange(twelveMonths, "3M");
    const delta = computeDeltas(twelveMonths, range)!;
    expect(delta.rangeAbs).toBe(range[range.length - 1].marketValue - range[0].marketValue);
    expect(delta.rangeDate).toBe(range[range.length - 1].date);
  });

  it("returns null when there's no history at all", () => {
    expect(computeDeltas([], [])).toBeNull();
  });
});
