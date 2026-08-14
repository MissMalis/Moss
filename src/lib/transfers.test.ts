import { describe, expect, it } from "vitest";
import { isCheckingAccount, transfersSafeToSpendImpact } from "./transfers";

const checking = { id: "checking", type: "Cash", is_forbidden_money: false };
const buffer = { id: "buffer", type: "Cash", is_forbidden_money: true };
const transit = { id: "transit", type: "Stored-value", is_forbidden_money: false };
const hysa = { id: "hysa", type: "HYSA", is_forbidden_money: false };

describe("isCheckingAccount", () => {
  it("is true for a plain Cash account", () => {
    expect(isCheckingAccount(checking)).toBe(true);
  });

  it("is false for the forbidden-money buffer, even though it's type Cash", () => {
    expect(isCheckingAccount(buffer)).toBe(false);
  });

  it("is false for a non-Cash type", () => {
    expect(isCheckingAccount(transit)).toBe(false);
  });
});

describe("transfersSafeToSpendImpact", () => {
  const accounts = [checking, buffer, transit, hysa];

  it("reduces spendable money (positive impact) when the source is checking", () => {
    const impact = transfersSafeToSpendImpact(
      [{ from_account_id: "checking", to_account_id: "transit", amount: 20 }],
      accounts,
    );
    expect(impact).toBe(20);
  });

  it("restores spendable money (negative impact) when the destination is checking", () => {
    const impact = transfersSafeToSpendImpact(
      [{ from_account_id: "hysa", to_account_id: "checking", amount: 100 }],
      accounts,
    );
    expect(impact).toBe(-100);
  });

  it("has no effect when neither side is checking", () => {
    const impact = transfersSafeToSpendImpact(
      [{ from_account_id: "hysa", to_account_id: "transit", amount: 50 }],
      accounts,
    );
    expect(impact).toBe(0);
  });

  it("has no effect moving into the buffer account (not spendable checking)", () => {
    const impact = transfersSafeToSpendImpact(
      [{ from_account_id: "checking", to_account_id: "buffer", amount: 30 }],
      accounts,
    );
    // Buffer isn't "checking" (is_forbidden_money), so this is an outflow from checking.
    expect(impact).toBe(30);
  });

  it("nets multiple transfers", () => {
    const impact = transfersSafeToSpendImpact(
      [
        { from_account_id: "checking", to_account_id: "transit", amount: 20 },
        { from_account_id: "hysa", to_account_id: "checking", amount: 15 },
      ],
      accounts,
    );
    expect(impact).toBe(5);
  });
});
