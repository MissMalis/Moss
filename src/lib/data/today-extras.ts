import { listAccounts, listHoldings } from "@/lib/data/accounts";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import { listMarketIndices } from "@/lib/data/market-indices";
import { listPurchasesInRange } from "@/lib/data/income";
import { listRecentPayPeriods } from "@/lib/data/history";
import { listTransfersInRange } from "@/lib/data/transfers";
import { listRecurringItems, listOccurrencesInRange, listCategories } from "@/lib/data/recurring";
import { computeNetWorth, aggregateSnapshots } from "@/lib/net-worth";
import { occurrenceInWindow } from "@/lib/periods";
import { groupByDate, type TransactionLike } from "@/lib/recent-transactions";
import { weekStrip, type UpcomingItem } from "@/lib/upcoming-week";
import { candyColorForCategory } from "@/lib/candy-colors";

const RECENT_LOOKBACK_DAYS = 21;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Everything the redesigned Today screen needs beyond the core Safe-to-
 * Spend math in getTodaySnapshot() — net worth for the hero graph and the
 * Assets/Liabilities boxes, the market ticker, and the Recent/Upcoming
 * panels. Kept separate from getTodaySnapshot so that function stays
 * focused on just the money math it's tested against.
 */
export async function getTodayExtras(todayISO: string) {
  const [accounts, holdings] = await Promise.all([listAccounts(), listHoldings()]);
  await ensureSnapshotsForToday({ accounts, holdings });

  const sinceISO = addDays(todayISO, -RECENT_LOOKBACK_DAYS);
  const weekEnd = addDays(todayISO, 7);

  const [snapshots, indices, purchases, recentPayPeriods, recurringItems, occurrences, categories, transfers] =
    await Promise.all([
      listAllSnapshots(),
      listMarketIndices(),
      listPurchasesInRange(sinceISO, todayISO),
      listRecentPayPeriods(sinceISO),
      listRecurringItems(),
      listOccurrencesInRange(sinceISO, weekEnd),
      listCategories(),
      listTransfersInRange(sinceISO, todayISO),
    ]);

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

  const netWorth = computeNetWorth(accounts, holdings);
  const assetsCount = accounts.filter((a) => a.type !== "Liabilities").length;
  const liabilitiesCount = accounts.filter((a) => a.type === "Liabilities").length;
  const historyPoints = aggregateSnapshots(
    snapshots.map((s) => ({
      snapshot_date: s.snapshot_date,
      account_id: s.account_id,
      contributed: s.contributed,
      market_value: s.market_value,
    })),
  );

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const occByKey = new Map(occurrences.map((o) => [`${o.recurring_item_id}|${o.occ_date}`, o]));

  // ---- Recent: logged purchases + posted bills + posted paychecks, newest first ----
  const transactions: TransactionLike[] = [];
  for (const p of purchases) {
    transactions.push({
      id: p.id,
      name: p.name,
      amount: p.amount,
      date: p.spent_on,
      kind: "outflow",
      category: p.category || null,
    });
  }
  const itemById = new Map(recurringItems.map((item) => [item.id, item]));
  for (const occ of occurrences) {
    if (!occ.posted || occ.occ_date < sinceISO || occ.occ_date > todayISO) continue;
    const item = itemById.get(occ.recurring_item_id);
    if (!item) continue;
    const amount = occ.actual_amount ?? occ.override_amount ?? item.amount;
    transactions.push({
      id: `${item.id}|${occ.occ_date}`,
      name: item.name,
      amount,
      date: occ.occ_date,
      kind: "outflow",
      category: item.category_id ? (categoryById.get(item.category_id)?.name ?? null) : null,
    });
  }
  for (const pp of recentPayPeriods) {
    if (pp.net_income == null) continue;
    transactions.push({
      id: pp.id,
      name: "Paycheck",
      amount: pp.net_income,
      date: pp.pay_date,
      kind: "income",
      category: null,
    });
  }
  // Transfers show up in the feed for visibility, but never as spend — see
  // lib/transfers.ts for why they're excluded from budgets/the ring/net worth.
  for (const t of transfers) {
    const toName = accountNameById.get(t.to_account_id) ?? "another account";
    transactions.push({
      id: t.id,
      name: `Transfer to ${toName}`,
      amount: t.amount,
      date: t.transfer_date,
      kind: "transfer",
      category: null,
    });
  }
  const recentGroups = groupByDate(transactions);

  // ---- Upcoming: the Mon–Sun week containing today, one column per day ----
  const upcomingItems: UpcomingItem[] = [];
  for (const item of recurringItems) {
    if (!item.active) continue;
    const occDate = occurrenceInWindow({ day: item.day_of_month }, todayISO, weekEnd);
    if (!occDate) continue;
    const key = `${item.id}|${occDate}`;
    const occ = occByKey.get(key);
    if (occ?.skipped) continue;
    const categoryName = item.category_id ? categoryById.get(item.category_id)?.name ?? null : null;
    upcomingItems.push({
      id: key,
      name: item.name,
      amount: occ?.actual_amount ?? occ?.override_amount ?? item.amount,
      date: occDate,
      categoryInitial: (categoryName ?? item.name).charAt(0).toUpperCase(),
      categoryColor: candyColorForCategory(categoryName ?? item.name),
    });
  }
  const upcomingWeek = weekStrip(todayISO, upcomingItems);

  return {
    netWorth,
    assetsCount,
    liabilitiesCount,
    historyPoints,
    indices,
    recentGroups,
    upcomingWeek,
  };
}
