// Pure net-worth aggregation. An account's value comes from its holdings
// when it has any (so a brokerage/retirement account's market value doesn't
// double-count against its stored `balance`); otherwise the stored balance
// is used directly (plain cash accounts, or system accounts fed by
// paycheck contributions). Liabilities balances are stored positive and
// subtracted.

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
    const holdingsValue = holdingsValueByAccount.get(a.id);
    const rawValue = holdingsValue !== undefined ? holdingsValue : a.balance;
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

const ACCOUNT_EMOJI: Record<string, string> = {
  Cash: "💵",
  HSA: "🏥",
  "Roth IRA": "🌱",
  "Traditional IRA": "🏛️",
  "Taxable Brokerage": "📈",
  Liabilities: "💳",
};

export function accountEmoji(type: string): string {
  return ACCOUNT_EMOJI[type] ?? "💰";
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
