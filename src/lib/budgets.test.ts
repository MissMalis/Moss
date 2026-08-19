import { describe, expect, it } from "vitest";
import { computeBudgetProgress, computeBudgetEarmark } from "./budgets";

describe("computeBudgetProgress", () => {
  it("sums checking-sourced purchases in the category, ignoring other payment sources", () => {
    const result = computeBudgetProgress(
      [{ id: "b1", category: "Food", cap_amount: 200 }],
      [
        { category: "Food", amount: 38, payment_source: "checking" },
        { category: "Food", amount: 400, payment_source: "investing" }, // shouldn't count
        { category: "Play", amount: 20, payment_source: "checking" }, // different category
      ],
    );
    expect(result).toEqual([{ id: "b1", category: "Food", cap: 200, spent: 38, pct: 19 }]);
  });

  it("caps pct at 100 when spending exceeds the cap", () => {
    const result = computeBudgetProgress(
      [{ id: "b1", category: "Food", cap_amount: 100 }],
      [{ category: "Food", amount: 150, payment_source: "checking" }],
    );
    expect(result[0].pct).toBe(100);
    expect(result[0].spent).toBe(150);
  });

  it("returns 0 spent for a budget with no matching purchases", () => {
    const result = computeBudgetProgress([{ id: "b1", category: "Play", cap_amount: 150 }], []);
    expect(result[0]).toEqual({ id: "b1", category: "Play", cap: 150, spent: 0, pct: 0 });
  });
});

describe("computeBudgetEarmark", () => {
  it("earmarks the full cap on the 1st regardless of spend so far", () => {
    const total = computeBudgetEarmark(
      [{ id: "b1", category: "Food", cap_amount: 200 }],
      new Map([["Food", 60]]),
      "2026-08-01",
      "2026-08-14",
    );
    expect(total).toBe(200);
  });

  it("grows past the cap once spend exceeds it — only the overspend is extra", () => {
    const total = computeBudgetEarmark(
      [{ id: "b1", category: "Food", cap_amount: 200 }],
      new Map([["Food", 250]]),
      "2026-08-01",
      "2026-08-14",
    );
    expect(total).toBe(250);
  });

  it("contributes zero for a window that doesn't contain the 1st — already earmarked earlier", () => {
    const total = computeBudgetEarmark(
      [{ id: "b1", category: "Food", cap_amount: 200 }],
      new Map([["Food", 250]]),
      "2026-08-15",
      "2026-08-28",
    );
    expect(total).toBe(0);
  });

  it("sums multiple budgets that all earmark in the same window", () => {
    const total = computeBudgetEarmark(
      [
        { id: "b1", category: "Food", cap_amount: 200 },
        { id: "b2", category: "Play", cap_amount: 50 },
      ],
      new Map([["Food", 10]]),
      "2026-08-01",
      "2026-08-14",
    );
    expect(total).toBe(250);
  });
});
