import { describe, expect, it } from "vitest";
import { buildPayableAccounts } from "./payable-accounts";

describe("buildPayableAccounts", () => {
  it("lists a checking account with its masked last4, routed to checking", () => {
    const options = buildPayableAccounts(
      [{ id: "a1", name: "TD Checking", type: "Checking", last4: "1234", debit_card_last4: null, is_forbidden_money: false }],
      [],
    );
    expect(options).toEqual([{ id: "a1", label: "TD Checking ·x1234", paymentSource: "checking", sourceAccountId: "a1", cardId: null }]);
  });

  it("lists HSA using its debit-card last4, routed to investing", () => {
    const options = buildPayableAccounts(
      [{ id: "a2", name: "HSA", type: "HSA", last4: null, debit_card_last4: "5678", is_forbidden_money: false }],
      [],
    );
    expect(options[0]).toEqual({ id: "a2", label: "HSA ·x5678", paymentSource: "investing", sourceAccountId: "a2", cardId: null });
  });

  it("lists a credit card by the linked card's own name+last4, routed to rewards_card", () => {
    const options = buildPayableAccounts(
      [{ id: "a3", name: "Amex Liability", type: "Credit card", last4: null, debit_card_last4: null, is_forbidden_money: false }],
      [{ id: "c1", name: "Amex Gold", last4: "1005", account_id: "a3" }],
    );
    expect(options[0]).toEqual({ id: "a3", label: "Amex Gold ·x1005", paymentSource: "rewards_card", sourceAccountId: null, cardId: "c1" });
  });

  it("skips a credit-card liability with no linked card", () => {
    const options = buildPayableAccounts(
      [{ id: "a4", name: "Unlinked card", type: "Credit card", last4: null, debit_card_last4: null, is_forbidden_money: false }],
      [],
    );
    expect(options).toHaveLength(0);
  });

  it("skips the forbidden-money buffer account", () => {
    const options = buildPayableAccounts(
      [{ id: "a5", name: "Buffer", type: "Checking", last4: null, debit_card_last4: null, is_forbidden_money: true }],
      [],
    );
    expect(options).toHaveLength(0);
  });

  it("skips non-payable types (401k, mortgage, ...)", () => {
    const options = buildPayableAccounts(
      [{ id: "a6", name: "401(k)", type: "401(k)", last4: null, debit_card_last4: null, is_forbidden_money: false }],
      [],
    );
    expect(options).toHaveLength(0);
  });

  it("shows the account name plain when no last4 is set", () => {
    const options = buildPayableAccounts(
      [{ id: "a7", name: "Transit card", type: "Stored-value", last4: null, debit_card_last4: null, is_forbidden_money: false }],
      [],
    );
    expect(options[0].label).toBe("Transit card");
  });
});
