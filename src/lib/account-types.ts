// Pure constants — no supabase import, so client components (the account
// wizard, the details-section edit form) can use these directly without
// pulling the server-only Supabase client into the browser bundle.

// Rev 06b §1: the wizard's step-1 type picker. "Cash" and "Stored-value"
// are kept out of the picker (superseded by Checking/Savings, and no
// longer offered as a new-account type) but stay valid values so existing
// rows keep working untouched.
export const ACCOUNT_TYPES = [
  "Checking",
  "Savings",
  "HYSA",
  "HSA",
  "401(k)",
  "Roth IRA",
  "Traditional IRA",
  "Taxable Brokerage",
  "Liabilities",
  "Cash",
  "Stored-value",
] as const;

// The literal wizard picker list (§1) — a subset of ACCOUNT_TYPES, in order.
export const WIZARD_ACCOUNT_TYPES = [
  "Checking",
  "Savings",
  "HYSA",
  "HSA",
  "401(k)",
  "Traditional IRA",
  "Roth IRA",
  "Taxable Brokerage",
  "Liabilities",
] as const;
