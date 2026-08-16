// Pure net-worth aggregation. An account's value is its stored `balance`
// (the cash sleeve — brief rev 02 §4: "contributions always land in cash
// first") plus whatever holdings it has, if any. For a plain Cash account
// or a "lump" investable account with no positions entered, holdings value
// is simply zero, so this reduces to the balance alone. Liabilities
// balances are stored positive and subtracted.

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

  const accountValues: AccountValuation[] = accounts.map((a) => {
    const holdingsValue = holdingsValueByAccount.get(a.id) ?? 0;
    const rawValue = a.balance + holdingsValue;
    const value = a.type === "Liabilities" ? -Math.abs(rawValue) : rawValue;
    return { id: a.id, name: a.name, type: a.type, value };
  });

  const byType: Record<string, number> = {};
  for (const av of accountValues) {
    byType[av.type] = (byType[av.type] ?? 0) + av.value;
  }

  const total = accountValues.reduce((sum, av) => sum + av.value, 0);

  return { total, byType, accounts: accountValues };
}

// Rev 04 §5: display-only relabeling. The stored `type` values (and every
// internal comparison against them) are untouched — same pattern as
// `system_key`/`payment_source` staying internal identifiers while the UI
// shows something friendlier.
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  HYSA: "High-Yield Savings Account",
  "Stored-value": "Prepaid / reloadable",
  Liabilities: "Liability",
  "401(k)": "401(k) / 403(b)",
};

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

// §5 account-builder fixes: holdings only exist for true investing types;
// HSA is cash-sleeve-only now (real HSAs can have both, but this revision
// simplifies HSA to cash so there's exactly one "has a genuine cash
// balance alongside holdings" type — none — everything else is one or the
// other). Every other type shows a plain balance (not framed as a "cash
// sleeve", since there's nothing else in the account to sit alongside).
export const HOLDINGS_TYPES = new Set(["401(k)", "Roth IRA", "Traditional IRA", "Taxable Brokerage"]);

export function accountGroup(type: string): "Investments" | "Cash" | "Liabilities" {
  if (type === "Liabilities") return "Liabilities";
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
