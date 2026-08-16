import { createBudget, updateBudget, deleteBudget } from "@/lib/actions/budgets";
import { formatMoney } from "@/lib/format";
import type { BudgetProgress } from "@/lib/budgets";
import { AddButton } from "@/components/AddButton";
import { IconCircle } from "@/components/IconCircle";
import { RowMenu } from "@/components/RowMenu";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, SCROLL_LIST } from "@/lib/ui";

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

/** Rev 06b §6: monthly budgets — reset on the 1st, tracked against the calendar month's checking-sourced spend. */
export function BudgetTracker({ budgets, categories }: { budgets: BudgetProgress[]; categories: CategoryOption[] }) {
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const budgetedNames = new Set(budgets.map((b) => b.category));
  const available = categories.filter((c) => !budgetedNames.has(c.name));

  return (
    <div className={`${CARD} flex h-full flex-col`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <p className={CARD_HEADER}>Budgets</p>
          <Tooltip text="Monthly caps that reset on the 1st — separate from the pay-period earmark model above." />
        </div>
        {available.length > 0 && (
          <AddButton label="Add a budget">
            <form action={createBudget} className="flex flex-wrap items-end gap-3">
              <label className={LABEL}>
                Category
                <select name="category" className={INPUT}>
                  {available.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL}>
                Monthly cap
                <input type="number" step="0.01" name="cap_amount" defaultValue={0} className={`w-28 ${INPUT}`} />
              </label>
              <button type="submit" className={BTN_SOLID}>
                Add budget
              </button>
            </form>
          </AddButton>
        )}
      </div>

      {budgets.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">No budgets set yet.</p>
      ) : (
        <div className={`mt-3 flex-1 space-y-3 ${SCROLL_LIST}`}>
          {budgets.map((b) => {
            const cat = categoryByName.get(b.category);
            const over = b.spent > b.cap;
            return (
              <div key={b.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                    <IconCircle value={cat?.emoji ?? null} label={b.category} color={cat?.color} variant="tinted" size="sm" />
                    {b.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[12.5px] tabular-nums ${over ? "text-bad" : "text-ink-3"}`}>
                      {formatMoney(b.spent)} / {formatMoney(b.cap)}
                    </span>
                    <RowMenu
                      popovers={[
                        {
                          label: "Edit cap",
                          content: (
                            <form action={updateBudget} className="flex items-center gap-2">
                              <input type="hidden" name="id" value={b.id} />
                              <input type="number" step="0.01" name="cap_amount" defaultValue={b.cap} className={`flex-1 ${INPUT}`} />
                              <button type="submit" className={BTN_SOLID}>
                                Save
                              </button>
                            </form>
                          ),
                        },
                      ]}
                    >
                      <ConfirmDeleteButton action={deleteBudget} hiddenFields={{ id: b.id }} itemLabel={`the ${b.category} budget`} variant="link" />
                    </RowMenu>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card-soft">
                  <div className={`h-full rounded-full ${over ? "bg-bad" : "bg-moss"}`} style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
