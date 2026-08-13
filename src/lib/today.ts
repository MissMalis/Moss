import { periodsForMonth, type Freq, type PayWindow } from "@/lib/periods";
import {
  buildOccurrencesForWindow,
  sumEarmarked,
  type OccurrenceStateLike,
  type RecurringItemLike,
} from "@/lib/recurring";

export interface IncomeSourceLike {
  id: string;
  net_per_check: number;
  freq: Freq;
  anchor_date: string | null;
  sm_day1: number;
  sm_day2: number;
}

export interface DeductionLike {
  id: string;
  income_source_id: string | null;
  amount: number;
  employer_match: number;
  target_account_key: string | null;
}

function windowsAround(source: IncomeSourceLike, todayISO: string): PayWindow[] {
  const today = new Date(todayISO + "T00:00:00");
  const inc = {
    freq: source.freq,
    smDays: [source.sm_day1, source.sm_day2] as [number, number],
    anchor: source.anchor_date ?? undefined,
  };
  const out: PayWindow[] = [];
  // Scan a window of months wide enough to always have >= 2 windows past
  // "today" even for biweekly schedules straddling month boundaries.
  for (let offset = -1; offset <= 3; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    out.push(...periodsForMonth(inc, d.getFullYear(), d.getMonth()));
  }
  const seen = new Set<string>();
  return out
    .filter((w) => (seen.has(w.payDate) ? false : (seen.add(w.payDate), true)))
    .sort((a, b) => a.payDate.localeCompare(b.payDate));
}

export function findCurrentWindow(windows: PayWindow[], todayISO: string): PayWindow | null {
  return windows.find((w) => w.start <= todayISO && todayISO <= w.end) ?? null;
}

export function findFutureWindows(
  windows: PayWindow[],
  currentWindow: PayWindow,
  count: number,
): PayWindow[] {
  return windows.filter((w) => w.payDate > currentWindow.payDate).slice(0, count);
}

function deductionsTotalForSource(deductions: DeductionLike[], sourceId: string): number {
  return deductions
    .filter((d) => d.income_source_id === sourceId)
    .reduce((sum, d) => sum + d.amount, 0);
}

/** Sum of (net_per_check - deductions) for every pay event any source has inside [start,end]. */
export function netIncomeForWindow(
  sources: IncomeSourceLike[],
  deductions: DeductionLike[],
  window: Pick<PayWindow, "start" | "end">,
  todayISO: string,
): number {
  let total = 0;
  for (const source of sources) {
    const dedTotal = deductionsTotalForSource(deductions, source.id);
    for (const w of windowsAround(source, todayISO)) {
      if (w.payDate >= window.start && w.payDate <= window.end) {
        total += source.net_per_check - dedTotal;
      }
    }
  }
  return total;
}

export interface ReserveReason {
  payDate: string;
  windowStart: string;
  windowEnd: string;
  shortfall: number;
}

export interface AutoReserveResult {
  reserve: number;
  reasons: ReserveReason[];
}

/**
 * Look `lookaheadCount` paychecks ahead (of the primary source's schedule).
 * If a future window's earmarked bills exceed that window's net income,
 * pull the shortfall back into today's reserve.
 */
export function computeAutoReserve(
  primarySource: IncomeSourceLike,
  allSources: IncomeSourceLike[],
  deductions: DeductionLike[],
  recurringItems: RecurringItemLike[],
  occurrenceState: Map<string, OccurrenceStateLike>,
  currentWindow: PayWindow,
  todayISO: string,
  lookaheadCount = 2,
): AutoReserveResult {
  const windows = windowsAround(primarySource, todayISO);
  const future = findFutureWindows(windows, currentWindow, lookaheadCount);

  const reasons: ReserveReason[] = [];
  for (const w of future) {
    const income = netIncomeForWindow(allSources, deductions, w, todayISO);
    const occurrences = buildOccurrencesForWindow(recurringItems, occurrenceState, w.start, w.end);
    const earmarked = sumEarmarked(occurrences);
    const shortfall = Math.max(0, earmarked - income);
    if (shortfall > 0) {
      reasons.push({ payDate: w.payDate, windowStart: w.start, windowEnd: w.end, shortfall });
    }
  }

  return { reserve: reasons.reduce((s, r) => s + r.shortfall, 0), reasons };
}

export interface TodayMath {
  window: PayWindow;
  income: number;
  rollover: number;
  earmarked: number;
  autoReserve: AutoReserveResult;
  purchasesTotal: number;
  safeToSpend: number;
}

export { windowsAround };
