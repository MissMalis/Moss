import { safeToSpend, type PayWindow } from "@/lib/periods";
import { buildOccurrencesForWindow, sumEarmarked } from "@/lib/recurring";
import {
  computeAutoReserve,
  findCurrentWindow,
  netIncomeForWindow,
  windowsAround,
  type DeductionLike,
  type IncomeSourceLike,
} from "@/lib/today";
import { listIncomeSourcesWithVersions, listDeductions, listPurchasesInRange, findPostedPayPeriod } from "@/lib/data/income";
import { listRecurringItems, listOccurrencesInRange, listCategories } from "@/lib/data/recurring";
import { closeElapsedPeriods } from "@/lib/data/close-periods";
import { listAccounts, listHoldings } from "@/lib/data/accounts";
import { listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import { listDismissedAlertIds } from "@/lib/data/alerts";
import { listTransfersInRange } from "@/lib/data/transfers";
import { transfersSafeToSpendImpact } from "@/lib/transfers";
import { reconciliationStatus } from "@/lib/cards";
import { buildReviewChecklist, type ReviewItem } from "@/lib/checklist";
import { lucideKey } from "@/lib/icons";

const CHECKLIST_LOOKBACK_DAYS = 45;

const DEFAULT_CATEGORY_ICON = lucideKey("credit-card");

export interface SpendingCategory {
  name: string;
  icon: string;
  amount: number;
}

export interface TodaySnapshot {
  hasPrimaryIncome: boolean;
  window: PayWindow | null;
  income: number;
  rollover: number;
  earmarked: number;
  autoReserve: { reserve: number; reasons: { payDate: string; shortfall: number }[] };
  purchasesTotal: number;
  safeToSpend: number;
  purchases: Awaited<ReturnType<typeof listPurchasesInRange>>;
  earmarkedItems: ReturnType<typeof buildOccurrencesForWindow>;
  spendingByCategory: SpendingCategory[];
  alreadyPosted: boolean;
  primarySource: IncomeSourceLike | null;
  reviewItems: ReviewItem[];
}

async function buildTodayReviewChecklist(): Promise<ReviewItem[]> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - CHECKLIST_LOOKBACK_DAYS);

  const [accounts, snapshots, holdings, recentPurchases, dismissedIds, deductions] = await Promise.all([
    listAccounts(),
    listAllSnapshots(),
    listHoldings(),
    listPurchasesInRange(lookbackStart.toISOString().slice(0, 10), todayISO),
    listDismissedAlertIds(),
    listDeductions(),
  ]);

  // Rev 04 §5: "contribution-fed" is derived from whether a deduction
  // actually targets this account, not a manually-set checkbox that can
  // drift from reality.
  const contributionFedKeys = new Set(
    deductions.map((d) => d.target_account_key).filter((k): k is string => !!k),
  );

  const contributedByAccount = new Map<string, number>();
  for (const s of snapshots) {
    // Snapshots come back ordered by snapshot_date, so the last write wins.
    contributedByAccount.set(s.account_id, s.contributed);
  }

  const accountsWithHoldings = new Set(holdings.map((h) => h.account_id).filter((id): id is string => !!id));

  // Most recent investing-sourced purchase per account — the "likely
  // trigger" reported alongside a cash-sleeve-under-minimum nudge.
  const recentInvestingChargeByAccount = new Map<string, number>();
  for (const p of [...recentPurchases].sort((a, b) => b.spent_on.localeCompare(a.spent_on))) {
    if (p.payment_source !== "investing" || !p.source_account_id) continue;
    if (!recentInvestingChargeByAccount.has(p.source_account_id)) {
      recentInvestingChargeByAccount.set(p.source_account_id, p.amount);
    }
  }

  const bufferAccount = accounts.find((a) => a.is_forbidden_money) ?? null;
  const status = bufferAccount ? reconciliationStatus(bufferAccount) : null;

  const items = buildReviewChecklist({
    accounts: accounts.map((a) => ({
      ...a,
      is_system: !!a.system_key && contributionFedKeys.has(a.system_key),
      hasHoldings: accountsWithHoldings.has(a.id),
    })),
    contributedByAccount,
    recentInvestingChargeByAccount,
    bufferAccountName: bufferAccount?.name ?? null,
    bufferShortBy: status?.shortBy ?? 0,
    todayISO,
  });

  return items.filter((item) => !dismissedIds.has(item.id));
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const todayISO = new Date().toISOString().slice(0, 10);

  const [incomeSources, deductions, recurringItems, reviewItems] = await Promise.all([
    listIncomeSourcesWithVersions(),
    listDeductions(),
    listRecurringItems(),
    buildTodayReviewChecklist(),
  ]);

  await closeElapsedPeriods({ incomeSources, deductions, recurringItems });

  // The window-driving source has to have an actual cadence — a one-off
  // deposit can land inside a window but can't define one.
  const primarySource = incomeSources.find((s) => s.freq !== "one-off") ?? null;
  if (!primarySource) {
    return {
      hasPrimaryIncome: false,
      window: null,
      income: 0,
      rollover: 0,
      earmarked: 0,
      autoReserve: { reserve: 0, reasons: [] },
      purchasesTotal: 0,
      safeToSpend: 0,
      purchases: [],
      earmarkedItems: [],
      spendingByCategory: [],
      alreadyPosted: false,
      primarySource: null,
      reviewItems,
    };
  }

  const windows = windowsAround(primarySource, todayISO);
  const window = findCurrentWindow(windows, todayISO);

  if (!window) {
    return {
      hasPrimaryIncome: true,
      window: null,
      income: 0,
      rollover: 0,
      earmarked: 0,
      autoReserve: { reserve: 0, reasons: [] },
      purchasesTotal: 0,
      safeToSpend: 0,
      purchases: [],
      earmarkedItems: [],
      spendingByCategory: [],
      alreadyPosted: false,
      primarySource,
      reviewItems,
    };
  }

  const previousWindow = windows
    .filter((w) => w.payDate < window.payDate)
    .sort((a, b) => b.payDate.localeCompare(a.payDate))[0];

  // Occurrence state spans the previous window (for the rollover estimate)
  // through the window two paychecks ahead (for auto-reserve).
  const scanStart = previousWindow?.start ?? window.start;
  const futureWindows = windows.filter((w) => w.payDate > window.payDate).slice(0, 2);
  const scanEnd = futureWindows.at(-1)?.end ?? window.end;

  const [occurrenceRows, purchasesInWindow, purchasesInPrevious, posted, categories, previousClosed, accounts, transfersInWindow, transfersInPrevious] =
    await Promise.all([
      listOccurrencesInRange(scanStart, scanEnd),
      listPurchasesInRange(window.start, window.end),
      previousWindow
        ? listPurchasesInRange(previousWindow.start, previousWindow.end)
        : Promise.resolve([]),
      findPostedPayPeriod(primarySource.id, window.payDate),
      listCategories(),
      previousWindow
        ? findPostedPayPeriod(primarySource.id, previousWindow.payDate)
        : Promise.resolve(null),
      listAccounts(),
      listTransfersInRange(window.start, window.end),
      previousWindow
        ? listTransfersInRange(previousWindow.start, previousWindow.end)
        : Promise.resolve([]),
    ]);

  const occurrenceState = new Map(
    occurrenceRows.map((o) => [`${o.recurring_item_id}|${o.occ_date}`, o]),
  );

  const earmarkedItems = buildOccurrencesForWindow(
    recurringItems,
    occurrenceState,
    window.start,
    window.end,
  );
  const earmarked = sumEarmarked(earmarkedItems);
  const income = netIncomeForWindow(incomeSources, deductions, window, todayISO);
  // Only checking-sourced spending draws down Safe-to-Spend (brief rev 02 §3)
  // — investing/stored-value spends come out of that account's own balance
  // and never touch this number. Loading a stored-value account IS a
  // checking-sourced "purchase" (that's the one Safe-to-Spend hit), so it's
  // naturally included here without special-casing.
  // A move-money transfer (rev 04 §4) isn't a purchase — it's folded into
  // this same total (not the `purchases` table) so it hits Safe-to-Spend
  // exactly like a checking-sourced expense would, without ever leaking
  // into spend reports/budgets/the ring, which only ever read `purchases`.
  const purchasesTotal =
    purchasesInWindow.filter((p) => p.payment_source === "checking").reduce((s, p) => s + p.amount, 0) +
    transfersSafeToSpendImpact(transfersInWindow, accounts);

  // Rollover prefers the frozen value from a closed previous period (the
  // period-close job runs above); only falls back to a live, one-step-back
  // approximation (no auto-reserve term) if that period hasn't closed yet.
  let rollover = 0;
  if (previousClosed?.closed && previousClosed.safe_to_spend != null) {
    rollover = Math.max(0, previousClosed.safe_to_spend);
  } else if (previousWindow) {
    const prevEarmarked = sumEarmarked(
      buildOccurrencesForWindow(recurringItems, occurrenceState, previousWindow.start, previousWindow.end),
    );
    const prevIncome = netIncomeForWindow(incomeSources, deductions, previousWindow, todayISO);
    const prevPurchasesTotal =
      purchasesInPrevious.filter((p) => p.payment_source === "checking").reduce((s, p) => s + p.amount, 0) +
      transfersSafeToSpendImpact(transfersInPrevious, accounts);
    const prevSTS = safeToSpend({
      income: prevIncome,
      rollover: 0,
      earmarkedBills: prevEarmarked,
      autoReserve: 0,
      loggedPurchases: prevPurchasesTotal,
    });
    rollover = Math.max(0, prevSTS);
  }

  const autoReserve = computeAutoReserve(
    primarySource,
    incomeSources,
    deductions as DeductionLike[],
    recurringItems,
    occurrenceState,
    window,
    todayISO,
    2,
  );

  const total = safeToSpend({
    income,
    rollover,
    earmarkedBills: earmarked,
    autoReserve: autoReserve.reserve,
    loggedPurchases: purchasesTotal,
  });

  // "Where it goes": earmarked bills (by category) + logged purchases (by
  // their free-text category), merged by name. Skipped bills don't count —
  // they were never actually spent.
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const categoriesByName = new Map(categories.map((c) => [c.name, c]));
  const byCategory = new Map<string, number>();
  for (const o of earmarkedItems) {
    if (o.skipped) continue;
    const name = o.item.category_id ? (categoriesById.get(o.item.category_id)?.name ?? "Other") : "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + o.amount);
  }
  for (const p of purchasesInWindow) {
    const name = p.category || "Play";
    byCategory.set(name, (byCategory.get(name) ?? 0) + p.amount);
  }
  const spendingByCategory: SpendingCategory[] = Array.from(byCategory.entries())
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({
      name,
      amount,
      icon: categoriesByName.get(name)?.emoji ?? DEFAULT_CATEGORY_ICON,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    hasPrimaryIncome: true,
    window,
    income,
    rollover,
    earmarked,
    autoReserve,
    purchasesTotal,
    safeToSpend: total,
    purchases: purchasesInWindow,
    earmarkedItems,
    spendingByCategory,
    alreadyPosted: !!posted,
    primarySource,
    reviewItems,
  };
}
