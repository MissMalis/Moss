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
import { listIncomeSources, listDeductions, listPurchasesInRange, findPostedPayPeriod } from "@/lib/data/income";
import { listRecurringItems, listOccurrencesInRange, listCategories } from "@/lib/data/recurring";

const DEFAULT_CATEGORY_EMOJI = "💳";

export interface SpendingCategory {
  name: string;
  emoji: string;
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
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const todayISO = new Date().toISOString().slice(0, 10);

  const [incomeSources, deductions, recurringItems] = await Promise.all([
    listIncomeSources(),
    listDeductions(),
    listRecurringItems(),
  ]);

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

  const [occurrenceRows, purchasesInWindow, purchasesInPrevious, posted, categories] =
    await Promise.all([
      listOccurrencesInRange(scanStart, scanEnd),
      listPurchasesInRange(window.start, window.end),
      previousWindow
        ? listPurchasesInRange(previousWindow.start, previousWindow.end)
        : Promise.resolve([]),
      findPostedPayPeriod(primarySource.id, window.payDate),
      listCategories(),
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
  const purchasesTotal = purchasesInWindow.reduce((s, p) => s + p.amount, 0);

  // Rollover is a live, one-step-back approximation (no auto-reserve term)
  // until the module-5 period-close job freezes it into a real snapshot.
  let rollover = 0;
  if (previousWindow) {
    const prevEarmarked = sumEarmarked(
      buildOccurrencesForWindow(recurringItems, occurrenceState, previousWindow.start, previousWindow.end),
    );
    const prevIncome = netIncomeForWindow(incomeSources, deductions, previousWindow, todayISO);
    const prevPurchasesTotal = purchasesInPrevious.reduce((s, p) => s + p.amount, 0);
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
      emoji: categoriesByName.get(name)?.emoji ?? DEFAULT_CATEGORY_EMOJI,
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
  };
}
