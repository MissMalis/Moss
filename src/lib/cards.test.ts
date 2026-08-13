import { describe, expect, it } from "vitest";
import { bestCardForCategory, reconciliationStatus } from "./cards";

const chase = { id: "chase", name: "Chase Sapphire", base_multiplier: 1 };
const amex = { id: "amex", name: "Amex Gold", base_multiplier: 1 };

describe("bestCardForCategory", () => {
  it("picks the card with the best category-specific multiplier", () => {
    const multipliers = [
      { card_id: "chase", category_id: "travel", multiplier: 2 },
      { card_id: "amex", category_id: "food", multiplier: 4 },
    ];
    const best = bestCardForCategory([chase, amex], multipliers, "food");
    expect(best?.card.id).toBe("amex");
    expect(best?.multiplier).toBe(4);
    expect(best?.isCategoryMatch).toBe(true);
  });

  it("falls back to base multiplier when no card has a category match", () => {
    const best = bestCardForCategory([chase, amex], [], "groceries");
    expect(best?.isCategoryMatch).toBe(false);
    expect(best?.multiplier).toBe(1);
  });

  it("returns null with no cards", () => {
    expect(bestCardForCategory([], [], "food")).toBeNull();
  });
});

describe("reconciliationStatus", () => {
  it("flags a shortfall when the real balance is behind the swept total", () => {
    const status = reconciliationStatus({ balance: 500, reconciled_balance: 350 });
    expect(status.shortBy).toBe(150);
  });

  it("has no shortfall once reconciled to match", () => {
    const status = reconciliationStatus({ balance: 500, reconciled_balance: 500 });
    expect(status.shortBy).toBe(0);
  });

  it("has no shortfall if never reconciled (nothing to compare against yet)", () => {
    const status = reconciliationStatus({ balance: 500, reconciled_balance: null });
    expect(status.shortBy).toBe(0);
  });

  it("doesn't go negative when the real balance is ahead", () => {
    const status = reconciliationStatus({ balance: 400, reconciled_balance: 600 });
    expect(status.shortBy).toBe(0);
  });
});
