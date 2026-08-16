import { describe, expect, it } from "vitest";
import {
  getAssetFieldConfig,
  getLiabilityFieldConfig,
  assetShowsBalanceField,
  assetShowsHoldingsList,
  assetShowsLumpCostBasis,
} from "./account-field-config";

describe("getAssetFieldConfig", () => {
  it("a checking account shows none of APY/min-cash/annual-limit/salary/contribution — the bug this revision fixes", () => {
    const cfg = getAssetFieldConfig("Checking");
    expect(cfg.showsAPY).toBe(false);
    expect(cfg.showsMinCash).toBe(false);
    expect(cfg.showsAnnualLimit).toBe(false);
    expect(cfg.showsSalaryAndMatch).toBe(false);
    expect(cfg.showsContribution).toBe(false);
    expect(cfg.showsLast4).toBe(true);
    expect(cfg.showsLinkedCard).toBe(true);
  });

  it("only HYSA shows APY", () => {
    expect(getAssetFieldConfig("HYSA").showsAPY).toBe(true);
    expect(getAssetFieldConfig("Checking").showsAPY).toBe(false);
    expect(getAssetFieldConfig("HSA").showsAPY).toBe(false);
  });

  it("HSA always shows both cash and holdings, with min-cash and debit-card last4, no annual limit", () => {
    const cfg = getAssetFieldConfig("HSA");
    expect(cfg.alwaysBothCashAndHoldings).toBe(true);
    expect(cfg.showsMinCash).toBe(true);
    expect(cfg.showsDebitCardLast4).toBe(true);
    expect(cfg.showsAnnualLimit).toBe(false);
    expect(cfg.showsContribution).toBe(true);
    expect(cfg.contributionTaxTreatment).toBe("pre_tax");
  });

  it("only 401(k) shows salary and match", () => {
    expect(getAssetFieldConfig("401(k)").showsSalaryAndMatch).toBe(true);
    expect(getAssetFieldConfig("Traditional IRA").showsSalaryAndMatch).toBe(false);
    expect(getAssetFieldConfig("Roth IRA").showsSalaryAndMatch).toBe(false);
  });

  it("Roth IRA contributes post-tax, Traditional IRA pre-tax", () => {
    expect(getAssetFieldConfig("Roth IRA").contributionTaxTreatment).toBe("post_tax");
    expect(getAssetFieldConfig("Traditional IRA").contributionTaxTreatment).toBe("pre_tax");
  });

  it("Taxable Brokerage has no contribution/limit", () => {
    const cfg = getAssetFieldConfig("Taxable Brokerage");
    expect(cfg.showsContribution).toBe(false);
    expect(cfg.showsAnnualLimit).toBe(false);
    expect(cfg.isHoldingsToggle).toBe(true);
  });

  it("Other (asset) shows notes and nothing else special", () => {
    const cfg = getAssetFieldConfig("Other");
    expect(cfg.showsNotes).toBe(true);
    expect(cfg.showsLast4).toBe(false);
    expect(cfg.isHoldingsToggle).toBe(false);
  });
});

describe("balance/holdings visibility helpers", () => {
  it("a holdings-toggle type in shares mode hides balance and shows the holdings list", () => {
    const cfg = getAssetFieldConfig("Taxable Brokerage");
    expect(assetShowsBalanceField(cfg, true)).toBe(false);
    expect(assetShowsHoldingsList(cfg, true)).toBe(true);
    expect(assetShowsLumpCostBasis(cfg, true)).toBe(false);
  });

  it("a holdings-toggle type in lump mode shows balance and cost basis, hides holdings", () => {
    const cfg = getAssetFieldConfig("Taxable Brokerage");
    expect(assetShowsBalanceField(cfg, false)).toBe(true);
    expect(assetShowsHoldingsList(cfg, false)).toBe(false);
    expect(assetShowsLumpCostBasis(cfg, false)).toBe(true);
  });

  it("HSA shows both balance and holdings regardless of the uses_holdings flag", () => {
    const cfg = getAssetFieldConfig("HSA");
    expect(assetShowsBalanceField(cfg, false)).toBe(true);
    expect(assetShowsBalanceField(cfg, true)).toBe(true);
    expect(assetShowsHoldingsList(cfg, false)).toBe(true);
    expect(assetShowsHoldingsList(cfg, true)).toBe(true);
  });

  it("a non-toggle type like Checking always shows balance, never holdings", () => {
    const cfg = getAssetFieldConfig("Checking");
    expect(assetShowsBalanceField(cfg, false)).toBe(true);
    expect(assetShowsHoldingsList(cfg, false)).toBe(false);
  });
});

describe("getLiabilityFieldConfig", () => {
  it("only Credit card shows a card last-4 field", () => {
    expect(getLiabilityFieldConfig("Credit card").showsCreditCardLast4).toBe(true);
    expect(getLiabilityFieldConfig("Student loans").showsCreditCardLast4).toBe(false);
  });

  it("only Auto loan and Mortgage show a term field", () => {
    expect(getLiabilityFieldConfig("Auto loan").showsTerm).toBe(true);
    expect(getLiabilityFieldConfig("Mortgage").showsTerm).toBe(true);
    expect(getLiabilityFieldConfig("Credit card").showsTerm).toBe(false);
    expect(getLiabilityFieldConfig("Personal loan").showsTerm).toBe(false);
  });
});
