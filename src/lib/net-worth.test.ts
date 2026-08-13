import { describe, expect, it } from "vitest";
import { computeNetWorth } from "./net-worth";

describe("computeNetWorth", () => {
  it("uses holdings market value instead of the stored balance when holdings exist", () => {
    const result = computeNetWorth(
      [{ id: "a1", name: "Brokerage", type: "Taxable Brokerage", balance: 500 }],
      [{ account_id: "a1", qty: 10, current_price: 100 }],
    );
    expect(result.total).toBe(1000); // not 500 + 1000
  });

  it("falls back to stored balance when an account has no holdings", () => {
    const result = computeNetWorth(
      [{ id: "a1", name: "Checking", type: "Cash", balance: 2500 }],
      [],
    );
    expect(result.total).toBe(2500);
  });

  it("subtracts liabilities", () => {
    const result = computeNetWorth(
      [
        { id: "a1", name: "Checking", type: "Cash", balance: 2500 },
        { id: "a2", name: "Credit card", type: "Liabilities", balance: 800 },
      ],
      [],
    );
    expect(result.total).toBe(1700);
    expect(result.byType["Liabilities"]).toBe(-800);
  });
});
