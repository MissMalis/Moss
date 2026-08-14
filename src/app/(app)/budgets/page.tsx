import { listBudgets } from "@/lib/data/budgets";
import { listCategories } from "@/lib/data/recurring";
import { getTodaySnapshot } from "@/lib/data/today";
import { createBudget, updateBudget, deleteBudget } from "@/lib/actions/budgets";
import { computeBudgetProgress } from "@/lib/budgets";
import { formatMoney } from "@/lib/format";
import { AddButton } from "@/components/AddButton";
import { EmptyState } from "@/components/EmptyState";
import { BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

export default async function BudgetsPage() {
  const [budgets, categories, snap] = await Promise.all([listBudgets(), listCategories(), getTodaySnapshot()]);

  const purchases = snap.purchases.map((p) => ({
    category: p.category,
    amount: p.amount,
    payment_source: p.payment_source,
  }));
  const progress = computeBudgetProgress(budgets, purchases);
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const budgetedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = categories.filter((c) => !budgetedCategories.has(c.name));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Budgets</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          Optional caps on top of Safe to spend — a way to watch a category without it replacing
          your earmarked bills.
        </p>
      </div>

      {progress.length === 0 ? (
        <EmptyState emoji="🎯" title="No budgets yet" hint="Add a category cap below." />
      ) : (
        <div className="space-y-2">
          {progress.map((b) => (
            <div key={b.id} className={ROW}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] text-ink">
                  <span aria-hidden>{categoryByName.get(b.category)?.emoji ?? "🎯"}</span>
                  {b.category}
                </span>
                <span className="text-[13px] text-ink-2">
                  {formatMoney(b.spent)} <span className="text-ink-3">of {formatMoney(b.cap)}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card-soft">
                <div
                  className={`h-full rounded-full ${b.pct >= 100 ? "bg-bad" : "bg-moss"}`}
                  style={{ width: `${b.pct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <form action={updateBudget} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <input
                    type="number"
                    step="0.01"
                    name="cap_amount"
                    defaultValue={b.cap}
                    className={`w-24 py-1 text-[12.5px] ${INPUT}`}
                  />
                  <button type="submit" className={LINK_QUIET}>
                    Update cap
                  </button>
                </form>
                <form action={deleteBudget}>
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit" className={LINK_QUIET}>
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddButton label="Add budget">
        {availableCategories.length === 0 ? (
          <p className="text-[13px] text-ink-3">Every category already has a budget.</p>
        ) : (
          <form action={createBudget} className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Category
              <select name="category" required className={INPUT}>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Cap
              <input type="number" step="0.01" name="cap_amount" required className={`w-28 ${INPUT}`} />
            </label>
            <button type="submit" className={BTN_SOLID}>
              Add budget
            </button>
          </form>
        )}
      </AddButton>
    </div>
  );
}
