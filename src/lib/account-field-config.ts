// Rev 06b v2 §3: THE fix — one shared per-type field visibility function,
// used by both the account wizard (step 2) and the detail page's edit
// form, so the two can never diverge (the bug this revision calls out: a
// checking account showing APY/APR/min-cash/annual-limit it has no
// business showing).

import { HOLDINGS_TOGGLE_TYPES, CONTRIBUTION_TYPES, TERM_LIABILITY_TYPES } from "@/lib/account-types";

export interface AssetFieldConfig {
  /** Has the "holdings or lump balance" toggle at all (§5). */
  isHoldingsToggle: boolean;
  /** HSA: always shows both a cash sleeve and holdings, no toggle (§3). */
  alwaysBothCashAndHoldings: boolean;
  showsLast4: boolean;
  showsLinkedCard: boolean;
  showsAPY: boolean;
  showsMinCash: boolean;
  showsDebitCardLast4: boolean;
  showsAnnualLimit: boolean;
  showsSalaryAndMatch: boolean;
  showsContribution: boolean;
  contributionTaxTreatment: "pre_tax" | "post_tax" | null;
  showsNotes: boolean;
}

export function getAssetFieldConfig(type: string): AssetFieldConfig {
  const isHSA = type === "HSA";
  const isHoldingsToggle = HOLDINGS_TOGGLE_TYPES.has(type);
  const isCheckingLike = type === "Checking" || type === "Savings" || type === "HYSA";
  // Rev 08 #10: last-4 applies to any account type that actually has a
  // number printed on it — checking-like, brokerage, and legacy
  // transit/prepaid (Stored-value) rows too, not just checking-like.
  const showsLast4 = isCheckingLike || type === "Taxable Brokerage" || type === "Stored-value";

  return {
    isHoldingsToggle,
    alwaysBothCashAndHoldings: isHSA,
    showsLast4,
    showsLinkedCard: isCheckingLike || isHSA,
    showsAPY: type === "HYSA",
    showsMinCash: isHSA,
    showsDebitCardLast4: isHSA,
    showsAnnualLimit: type === "401(k)" || type === "Traditional IRA" || type === "Roth IRA",
    showsSalaryAndMatch: type === "401(k)",
    showsContribution: CONTRIBUTION_TYPES.has(type),
    contributionTaxTreatment: type === "Roth IRA" ? "post_tax" : CONTRIBUTION_TYPES.has(type) ? "pre_tax" : null,
    showsNotes: type === "Other",
  };
}

/** Whether the plain balance field shows, given the account's live holdings-mode state. */
export function assetShowsBalanceField(cfg: AssetFieldConfig, usesHoldings: boolean): boolean {
  return cfg.alwaysBothCashAndHoldings || !cfg.isHoldingsToggle || !usesHoldings;
}

/** Whether the holdings/positions list shows, given the account's live holdings-mode state. */
export function assetShowsHoldingsList(cfg: AssetFieldConfig, usesHoldings: boolean): boolean {
  return cfg.alwaysBothCashAndHoldings || (cfg.isHoldingsToggle && usesHoldings);
}

/** Total-cost-basis field only makes sense in lump mode for a toggle-eligible type (§5). */
export function assetShowsLumpCostBasis(cfg: AssetFieldConfig, usesHoldings: boolean): boolean {
  return cfg.isHoldingsToggle && !usesHoldings;
}

export interface LiabilityFieldConfig {
  showsCreditCardLast4: boolean;
  showsTerm: boolean;
}

export function getLiabilityFieldConfig(type: string): LiabilityFieldConfig {
  return {
    showsCreditCardLast4: type === "Credit card",
    showsTerm: TERM_LIABILITY_TYPES.has(type),
  };
}
