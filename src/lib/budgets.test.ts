import { describe, expect, it } from "vitest";
import { computeBudgetProgress } from "./budgets";

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
