// Rev 03 §4: optional per-category caps that layer on top of Safe to Spend
// — "play money" tracking, not a replacement for the earmark/envelope
// model. Spend is checking-sourced purchases only (the same money Safe to
// Spend tracks); investing/stored-value spends and quarantined card
// charges don't touch a budget, same as they don't touch Safe to Spend.

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

export function computeBudgetProgress(budgets: BudgetLike[], purchases: PurchaseLike[]): BudgetProgress[] {
  const spentByCategory = new Map<string, number>();
  for (const p of purchases) {
    if (p.payment_source !== "checking") continue;
    spentByCategory.set(p.category, (spentByCategory.get(p.category) ?? 0) + p.amount);
  }

  return budgets.map((b) => {
    const spent = spentByCategory.get(b.category) ?? 0;
    const pct = b.cap_amount > 0 ? Math.min(100, (spent / b.cap_amount) * 100) : 0;
    return { id: b.id, category: b.category, cap: b.cap_amount, spent, pct };
  });
}
