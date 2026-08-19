import { describe, expect, it } from "vitest";
import { buildReviewChecklist, type ReviewAccountLike } from "./checklist";

const TODAY = "2026-08-13";

function account(overrides: Partial<ReviewAccountLike> & { id: string; name: string; type: string }): ReviewAccountLike {
  return {
    balance: 0,
    annual_contribution_limit: null,
    min_cash: null,
    is_system: false,
    balance_updated_at: null,
    hasHoldings: false,
    ...overrides,
  };
}

const noContext = {
  contributedByAccount: new Map<string, number>(),
  recentInvestingChargeByAccount: new Map<string, number>(),
  bufferAccountName: null,
  bufferShortBy: 0,
  todayISO: TODAY,
};

describe("buildReviewChecklist", () => {
  it("flags a cash sleeve under its min-cash line, naming the actual triggering charge", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "HSA", type: "HSA", balance: 900, min_cash: 1000 })],
      ...noContext,
      recentInvestingChargeByAccount: new Map([["a1", 60]]),
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("A $60.00 charge on HSA likely triggered an auto-sell");
    expect(items[0].href).toBe("/net-worth/a1");
  });

  it("falls back to a computed shortfall when no specific triggering charge is known", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "HSA", type: "HSA", balance: 900, min_cash: 1000 })],
      ...noContext,
    });
    expect(items[0].message).toBe("A $100.00 charge on HSA likely triggered an auto-sell");
  });

  it("without a configured min_cash, only flags once the balance actually goes negative", () => {
    const healthy = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "HSA", type: "HSA", balance: 5 })],
      ...noContext,
    });
    expect(healthy).toHaveLength(0);

    const negative = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "HSA", type: "HSA", balance: -60 })],
      ...noContext,
    });
    expect(negative[0].message).toBe("A $60.00 charge on HSA likely triggered an auto-sell");
  });

  it("does not flag a negative balance on a non-investable account (e.g. a liability)", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "Credit card", type: "Liabilities", balance: -400 })],
      ...noContext,
    });
    expect(items).toHaveLength(0);
  });

  it("flags un-invested cash sitting in a contribution-fed account with holdings", () => {
    const items = buildReviewChecklist({
      accounts: [
        account({ id: "a1", name: "Roth IRA", type: "Roth IRA", balance: 150, is_system: true, hasHoldings: true }),
      ],
      ...noContext,
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("$150.00 contributed to your Roth IRA since you last updated positions");
    expect(items[0].href).toBe("/net-worth/a1");
  });

  it("does not flag un-invested cash on an account the user manages directly (not is_system)", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "Brokerage", type: "Taxable Brokerage", balance: 150, hasHoldings: true })],
      ...noContext,
    });
    expect(items).toHaveLength(0);
  });

  it("flags a stale lump balance on a contribution-fed account with no holdings", () => {
    const items = buildReviewChecklist({
      accounts: [
        account({
          id: "a1",
          name: "401(k)",
          type: "401(k)",
          balance: 42000,
          is_system: true,
          hasHoldings: false,
          balance_updated_at: "2026-07-01T00:00:00Z",
        }),
      ],
      ...noContext,
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("Your 401(k) lump hasn't been refreshed in 43 days");
  });

  it("does not flag a lump balance refreshed recently", () => {
    const items = buildReviewChecklist({
      accounts: [
        account({
          id: "a1",
          name: "401(k)",
          type: "401(k)",
          balance: 42000,
          is_system: true,
          hasHoldings: false,
          balance_updated_at: "2026-08-10T00:00:00Z",
        }),
      ],
      ...noContext,
    });
    expect(items).toHaveLength(0);
  });

  it("flags a low stored-value balance", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "Transit card", type: "Stored-value", balance: 8 })],
      ...noContext,
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("Transit card is down to $8.00");
    expect(items[0].href).toBe("/expenses");
  });

  it("flags an account within 10% of its contribution limit", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "401(k)", type: "401(k)", balance: 500, annual_contribution_limit: 1000 })],
      ...noContext,
      contributedByAccount: new Map([["a1", 950]]),
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("401(k) has $50.00 left before its contribution limit");
  });

  it("flags an account that's gone over its contribution limit", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "401(k)", type: "401(k)", balance: 500, annual_contribution_limit: 1000 })],
      ...noContext,
      contributedByAccount: new Map([["a1", 1200]]),
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("401(k) is $200.00 over its $1,000.00 contribution limit");
  });

  it("flags a buffer account that's short against swept charges", () => {
    const items = buildReviewChecklist({
      accounts: [],
      ...noContext,
      bufferAccountName: "Buffer",
      bufferShortBy: 25,
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("Buffer is short $25.00 against what's been swept");
    expect(items[0].href).toBe("/sweep");
  });

  it("returns nothing when everything is healthy", () => {
    const items = buildReviewChecklist({
      accounts: [
        account({ id: "a1", name: "Checking", type: "Cash", balance: 2000 }),
        account({ id: "a2", name: "HSA", type: "HSA", balance: 300, annual_contribution_limit: 4000 }),
      ],
      ...noContext,
      contributedByAccount: new Map([["a2", 400]]),
      bufferAccountName: "Buffer",
      bufferShortBy: 0,
    });
    expect(items).toHaveLength(0);
  });

  it("nudges to review 401(k) settings after a recent paycheck change", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "401(k)", type: "401(k)", balance: 5000 })],
      ...noContext,
      lastIncomeChangeISO: "2026-08-05",
    });
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("Your paycheck amount changed 8 days ago. Check salary and contribution % on your 401(k)");
    expect(items[0].href).toBe("/net-worth");
  });

  it("does not nudge once the income-change window has passed", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "401(k)", type: "401(k)", balance: 5000 })],
      ...noContext,
      lastIncomeChangeISO: "2026-07-01",
    });
    expect(items).toHaveLength(0);
  });

  it("does not nudge without a 401(k) account, even after a recent change", () => {
    const items = buildReviewChecklist({
      accounts: [account({ id: "a1", name: "Roth IRA", type: "Roth IRA", balance: 5000 })],
      ...noContext,
      lastIncomeChangeISO: "2026-08-10",
    });
    expect(items).toHaveLength(0);
  });
});
