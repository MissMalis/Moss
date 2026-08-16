// Pure net-worth aggregation. An asset's value is its stored `balance`
// (the cash sleeve — brief rev 02 §4: "contributions always land in cash
// first") plus whatever holdings it has, if any. For a plain Cash account
// or a "lump" investable account with no positions entered, holdings value
// is simply zero, so this reduces to the balance alone. A liability's
// value is the balance-weighted rollup of its sub-loans (rev 06b v2 §4) —
// falling back to its own `balance` for legacy rows that never got one.

import { LIABILITY_TYPE_SET, HOLDINGS_TOGGLE_TYPES } from "@/lib/account-types";

export interface AccountForNetWorth {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export interface HoldingForNetWorth {
  account_id: string | null;
  qty: number;
  current_price: number;
}

export interface LiabilityLoanForNetWorth {
  account_id: string;
  balance: number;
}

export interface AccountValuation {
  id: string;
  name: string;
  type: string;
  value: number;
}

export interface NetWorthResult {
  total: number;
  byType: Record<string, number>;
  accounts: AccountValuation[];
}

export function computeNetWorth(
  accounts: AccountForNetWorth[],
  holdings: HoldingForNetWorth[],
  liabilityLoans: LiabilityLoanForNetWorth[] = [],
): NetWorthResult {
  const holdingsValueByAccount = new Map<string, number>();
  for (const h of holdings) {
    if (!h.account_id) continue;
    const value = h.qty * h.current_price;
    holdingsValueByAccount.set(
      h.account_id,
      (holdingsValueByAccount.get(h.account_id) ?? 0) + value,
    );
  }

  const loanTotalByAccount = new Map<string, number>();
  const hasLoans = new Set<string>();
  for (const l of liabilityLoans) {
    hasLoans.add(l.account_id);
    loanTotalByAccount.set(l.account_id, (loanTotalByAccount.get(l.account_id) ?? 0) + l.balance);
  }

  const accountValues: AccountValuation[] = accounts.map((a) => {
    if (LIABILITY_TYPE_SET.has(a.type)) {
      const rawValue = hasLoans.has(a.id) ? (loanTotalByAccount.get(a.id) ?? 0) : a.balance;
      return { id: a.id, name: a.name, type: a.type, value: -Math.abs(rawValue) };
    }
    const holdingsValue = holdingsValueByAccount.get(a.id) ?? 0;
    return { id: a.id, name: a.name, type: a.type, value: a.balance + holdingsValue };
  });

  const byType: Record<string, number> = {};
  for (const av of accountValues) {
    byType[av.type] = (byType[av.type] ?? 0) + av.value;
  }

  const total = accountValues.reduce((sum, av) => sum + av.value, 0);

  return { total, byType, accounts: accountValues };
}

/** Balance-weighted APR across a liability's sub-loans (rev 06b v2 §4: "$38,000 · 6.4% blended"). */
export function blendedApr(loans: { balance: number; apr_pct: number | null }[]): number | null {
  const total = loans.reduce((s, l) => s + l.balance, 0);
  if (total <= 0) return null;
  const weighted = loans.reduce((s, l) => s + l.balance * (l.apr_pct ?? 0), 0);
  return Math.round((weighted / total) * 1000) / 1000;
}

// Rev 04 §5 / Rev 06b v2 §2: display-only relabeling. The stored `type`
// values (and every internal comparison against them) are untouched —
// same pattern as `system_key`/`payment_source` staying internal
// identifiers while the UI shows something friendlier.
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  HYSA: "High-Yield Savings Account",
  HSA: "Health Savings Account (HSA)",
  "Stored-value": "Prepaid / reloadable",
  Liabilities: "Liability",
  "401(k)": "401(k) / 403(b)",
  "Other Debt": "Other",
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

// §5 account-builder fixes: holdings only exist for true investing types;
// HSA always shows both a cash sleeve and holdings (rev 06b v2 §3 — the
// rev 05 cash-sleeve-only simplification was reverted). Every other type
// shows a plain balance (not framed as a "cash sleeve", since there's
// nothing else in the account to sit alongside).
export const HOLDINGS_TYPES = HOLDINGS_TOGGLE_TYPES;

export function accountGroup(type: string): "Investments" | "Cash" | "Liabilities" {
  if (LIABILITY_TYPE_SET.has(type)) return "Liabilities";
  if (HOLDINGS_TYPES.has(type) || type === "HSA") return "Investments";
  return "Cash";
}

export interface SnapshotPoint {
  snapshot_date: string;
  account_id: string;
  contributed: number;
  market_value: number;
}

export interface HistoryPoint {
  date: string;
  contributed: number;
  marketValue: number;
}

/** Sums per-account snapshots into one portfolio-wide series, by date. */
export function aggregateSnapshots(snapshots: SnapshotPoint[]): HistoryPoint[] {
  const byDate = new Map<string, { contributed: number; marketValue: number }>();
  for (const s of snapshots) {
    const entry = byDate.get(s.snapshot_date) ?? { contributed: 0, marketValue: 0 };
    entry.contributed += s.contributed;
    entry.marketValue += s.market_value;
    byDate.set(s.snapshot_date, entry);
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, contributed: v.contributed, marketValue: v.marketValue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
