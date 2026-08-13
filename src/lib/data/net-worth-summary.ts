import { listAccounts, listHoldings } from "@/lib/data/accounts";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import { aggregateSnapshots, computeNetWorth, type HistoryPoint } from "@/lib/net-worth";

export interface NetWorthSummary {
  total: number;
  growthPct: number | null;
  history: HistoryPoint[];
}

/** Lightweight net-worth summary for the Today screen (total, % growth, history for the graph). */
export async function getNetWorthSummary(): Promise<NetWorthSummary> {
  const [accounts, holdings] = await Promise.all([listAccounts(), listHoldings()]);
  await ensureSnapshotsForToday({ accounts, holdings });
  const snapshots = await listAllSnapshots();

  const netWorth = computeNetWorth(accounts, holdings);
  const history = aggregateSnapshots(snapshots);
  const latest = history[history.length - 1];
  const growthPct =
    latest && latest.contributed > 0
      ? ((latest.marketValue - latest.contributed) / latest.contributed) * 100
      : null;

  return { total: netWorth.total, growthPct, history };
}
