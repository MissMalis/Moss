// Rev 03 §4/Rev 09 §3: optional per-category caps that layer on top of
// Safe to Spend — "play money" tracking, not a replacement for the
// earmark/envelope model. Spend is checking-sourced purchases only (the
// same money Safe to Spend tracks); investing/stored-value spends and
// quarantined card charges don't touch a budget, same as they don't touch
// Safe to Spend.

import { occurrenceInWindow } from "@/lib/periods";

export interface BudgetLike {
  id: string;
  category: string;
  cap_amount: number;
}

export interface PurchaseLike {
  category: string;
  amount: number;
  payment_source: string;
}

export interface BudgetProgress {
  id: string;
  category: string;
  cap: number;
  spent: number;
  pct: number;
}

export function spentByCategory(purchases: PurchaseLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of purchases) {
    if (p.payment_source !== "checking") continue;
    out.set(p.category, (out.get(p.category) ?? 0) + p.amount);
  }
  return out;
}

export function computeBudgetProgress(budgets: BudgetLike[], purchases: PurchaseLike[]): BudgetProgress[] {
  const spent = spentByCategory(purchases);
  return budgets.map((b) => {
    const s = spent.get(b.category) ?? 0;
    const pct = b.cap_amount > 0 ? Math.min(100, (s / b.cap_amount) * 100) : 0;
    return { id: b.id, category: b.category, cap: b.cap_amount, spent: s, pct };
  });
}

/**
 * Rev 09 §3.1: "consume-the-earmark" — a budget behaves like a variable
 * bill that occurs once, on the 1st of the month (day_of_month=1), so it
 * reuses the exact same occurrence machinery as any other bill
 * (occurrenceInWindow) rather than a parallel scheme. Its earmark is
 * `max(cap, monthSpend)`: the full cap commits on the 1st regardless of
 * spend so far; once spend exceeds the cap, the earmark grows to match
 * (so only the OVERSPEND — never the already-committed cap — additionally
 * hits Safe to Spend); under budget, the earmark never drops below cap
 * (so it never look like money got "returned" mid-month — the unspent
 * remainder simply isn't re-earmarked once the month rolls over).
 *
 * Because it only fires in the ONE pay-period window containing the 1st
 * (exactly like any other monthly bill), a mid-month window that doesn't
 * contain the 1st contributes zero new earmark here — by design, that
 * spend was already fully committed by the earlier window's earmark.
 * Budget-category purchases must be excluded from the caller's own
 * `loggedPurchases` total in EVERY window (not just the one with the
 * earmark) or they'd hit Safe to Spend a second time on top of it.
 */
export function computeBudgetEarmark(
  budgets: BudgetLike[],
  monthSpend: Map<string, number>,
  windowStartISO: string,
  windowEndISO: string,
): number {
  const occDate = occurrenceInWindow({ day: 1 }, windowStartISO, windowEndISO);
  if (!occDate) return 0;
  return budgets.reduce((sum, b) => sum + Math.max(b.cap_amount, monthSpend.get(b.category) ?? 0), 0);
}
