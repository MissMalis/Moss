import { createClient } from "@/lib/supabase/server";
import { safeToSpend } from "@/lib/periods";
import { buildOccurrencesForWindow, sumEarmarked } from "@/lib/recurring";
import { computeAutoReserve, netIncomeForWindow, windowsAround } from "@/lib/today";
import { listIncomeSourcesWithVersions, listDeductions, listPurchasesInRange } from "@/lib/data/income";
import { listRecurringItems, listOccurrencesInRange } from "@/lib/data/recurring";

const LOOKBACK_MONTHS = 6;

type IncomeSources = Awaited<ReturnType<typeof listIncomeSourcesWithVersions>>;
type Deductions = Awaited<ReturnType<typeof listDeductions>>;
type RecurringItems = Awaited<ReturnType<typeof listRecurringItems>>;

/**
 * Lazy period-close job (brief §3): any window whose end has passed and
 * isn't marked closed yet gets its final numbers computed and frozen into
 * `pay_periods`, along with a snapshot of that window's bills/purchases as
 * they were. Runs oldest-first so each period's rollover can read the
 * previous (now-closed) period's frozen safe_to_spend, building a real
 * chain instead of a live approximation.
 *
 * Accepts already-fetched income sources/deductions/recurring items when
 * the caller (Today) has them, to skip a duplicate round of queries it's
 * about to make again right after this returns.
 */
export async function closeElapsedPeriods(preloaded?: {
  incomeSources: IncomeSources;
  deductions: Deductions;
  recurringItems: RecurringItems;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const todayISO = new Date().toISOString().slice(0, 10);

  const [incomeSources, deductions, recurringItems] = preloaded
    ? [preloaded.incomeSources, preloaded.deductions, preloaded.recurringItems]
    : await Promise.all([listIncomeSourcesWithVersions(), listDeductions(), listRecurringItems()]);

  const primarySource = incomeSources.find((s) => s.freq !== "one-off");
  if (!primarySource) return;

  const anchor = new Date(todayISO + "T00:00:00");
  const windows = Array.from({ length: LOOKBACK_MONTHS + 1 }, (_, i) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    return windowsAround(primarySource, d.toISOString().slice(0, 10));
  })
    .flat()
    .filter((w, i, arr) => arr.findIndex((x) => x.payDate === w.payDate) === i)
    .filter((w) => w.end < todayISO)
    .sort((a, b) => a.payDate.localeCompare(b.payDate));

  if (windows.length === 0) return;

  const { data: existingClosed, error: closedErr } = await supabase
    .from("pay_periods")
    .select("pay_date")
    .eq("income_source_id", primarySource.id)
    .eq("closed", true);
  if (closedErr) throw closedErr;
  const alreadyClosed = new Set((existingClosed ?? []).map((p) => p.pay_date));

  const pending = windows.filter((w) => !alreadyClosed.has(w.payDate));
  if (pending.length === 0) return;

  const scanStart = windows[0].start;
  const scanEnd = todayISO;
  const [occurrenceRows] = await Promise.all([listOccurrencesInRange(scanStart, scanEnd)]);
  const occurrenceState = new Map(
    occurrenceRows.map((o) => [`${o.recurring_item_id}|${o.occ_date}`, o]),
  );

  let previousSafeToSpend = 0;
  // Seed from the most recent already-closed period, if any exists just
  // before the earliest pending window.
  const { data: priorClosed } = await supabase
    .from("pay_periods")
    .select("pay_date, safe_to_spend")
    .eq("income_source_id", primarySource.id)
    .eq("closed", true)
    .lt("pay_date", pending[0].payDate)
    .order("pay_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorClosed?.safe_to_spend != null) {
    previousSafeToSpend = Math.max(0, priorClosed.safe_to_spend);
  }

  for (const window of pending) {
    const earmarkedItems = buildOccurrencesForWindow(
      recurringItems,
      occurrenceState,
      window.start,
      window.end,
    );
    const earmarked = sumEarmarked(earmarkedItems);
    const income = netIncomeForWindow(incomeSources, deductions, window, window.payDate);
    const purchasesInWindow = await listPurchasesInRange(window.start, window.end);
    // Only checking-sourced spending hit Safe-to-Spend (brief rev 02 §3).
    const purchasesTotal = purchasesInWindow
      .filter((p) => p.payment_source === "checking")
      .reduce((s, p) => s + p.amount, 0);
    const autoReserve = computeAutoReserve(
      primarySource,
      incomeSources,
      deductions,
      recurringItems,
      occurrenceState,
      window,
      window.payDate,
      2,
    );

    const total = safeToSpend({
      income,
      rollover: previousSafeToSpend,
      earmarkedBills: earmarked,
      autoReserve: autoReserve.reserve,
      loggedPurchases: purchasesTotal,
    });

    const snapshot = {
      earmarked: earmarkedItems
        .filter((o) => !o.skipped)
        .map((o) => ({ name: o.item.name, occDate: o.occDate, amount: o.amount })),
      purchases: purchasesInWindow.map((p) => ({
        name: p.name,
        amount: p.amount,
        spent_on: p.spent_on,
        category: p.category,
      })),
    };

    const { error } = await supabase.from("pay_periods").upsert(
      {
        user_id: user.id,
        income_source_id: primarySource.id,
        pay_date: window.payDate,
        window_start: window.start,
        window_end: window.end,
        net_income: income,
        rollover_in: previousSafeToSpend,
        earmarked_total: earmarked,
        auto_reserved: autoReserve.reserve,
        purchases_total: purchasesTotal,
        safe_to_spend: total,
        closed: true,
        snapshot,
      },
      { onConflict: "income_source_id,pay_date" },
    );
    if (error) throw error;

    previousSafeToSpend = Math.max(0, total);
  }
}
