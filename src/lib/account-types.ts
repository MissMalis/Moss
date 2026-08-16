// Pure constants — no supabase import, so client components (the account
// wizard, the details-section edit form) can use these directly without
// pulling the server-only Supabase client into the browser bundle.

// Rev 06b v2 §1-2: assets and liabilities are separate wizards now (two
// buttons on Net worth), each with their own type picker. "Cash" and
// "Stored-value" are legacy values (pre-06b rows) kept valid but not
// offered in either picker; "Liabilities" is the legacy liability type,
// superseded by the specific liability types below.
export const ASSET_TYPES = [
  "Checking",
  "Savings",
  "HYSA",
  "HSA",
  "401(k)",
  "Traditional IRA",
  "Roth IRA",
  "Taxable Brokerage",
  "Other",
] as const;

// "Other Debt" (not "Other") so its stored type string never collides
// with the asset "Other" above — accountGroup() couldn't otherwise tell
// an asset-Other row from a liability-Other row apart.
export const LIABILITY_TYPES = [
  "Credit card",
  "Student loans",
  "Auto loan",
  "Mortgage",
  "Personal loan",
  "Medical debt",
  "Other Debt",
] as const;

const LEGACY_TYPES = ["Cash", "Stored-value", "Liabilities"] as const;

export const ACCOUNT_TYPES = [...ASSET_TYPES, ...LIABILITY_TYPES, ...LEGACY_TYPES] as const;

export const LIABILITY_TYPE_SET: ReadonlySet<string> = new Set([...LIABILITY_TYPES, "Liabilities"]);

// Types whose account carries loan-style "term" info (auto loan / mortgage).
export const TERM_LIABILITY_TYPES: ReadonlySet<string> = new Set(["Auto loan", "Mortgage"]);

// Investing types with the "holdings or lump balance" toggle (§5). HSA is
// deliberately excluded — it always shows both a cash sleeve and holdings.
export const HOLDINGS_TOGGLE_TYPES: ReadonlySet<string> = new Set(["401(k)", "Traditional IRA", "Roth IRA", "Taxable Brokerage"]);

// Types with a pre/post-tax contribution (§6/§7).
export const CONTRIBUTION_TYPES: ReadonlySet<string> = new Set(["HSA", "401(k)", "Traditional IRA", "Roth IRA"]);
