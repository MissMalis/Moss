import { listCategories, listRecurringItems, listOccurrencesInRange } from "@/lib/data/recurring";
import { listPurchasesInRange } from "@/lib/data/income";
import { listAccounts } from "@/lib/data/accounts";
import { listCards } from "@/lib/data/cards";
import { getSettings } from "@/lib/data/settings";
import { deletePurchase } from "@/lib/actions/income";
import { buildOccurrencesForWindow } from "@/lib/recurring";
import { LogExpenseForm } from "@/components/LogExpenseForm";
import { RecentList } from "@/components/RecentList";
import { SpendingRing } from "@/components/SpendingRing";
import { EmptyState } from "@/components/EmptyState";
import { CARD, CARD_HEADER, SCROLL_LIST } from "@/lib/ui";
import { groupByDate, type TransactionLike } from "@/lib/recent-transactions";
import { lucideKey } from "@/lib/icons";

const INVESTING_TYPES = new Set(["HSA", "401(k)", "Roth IRA", "Traditional IRA", "Taxable Brokerage"]);
const DEFAULT_CATEGORY_ICON = lucideKey("credit-card");

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default async function LogExpensePage() {
  const { start, end } = currentMonthWindow();
  const [categories, items, occurrenceRows, purchases, accounts, cards, settings] = await Promise.all([
    listCategories(),
    listRecurringItems(),
    listOccurrencesInRange(start, end),
    listPurchasesInRange(start, end),
    listAccounts(),
    listCards(),
    getSettings(),
  ]);

  const investingAccounts = accounts.filter((a) => INVESTING_TYPES.has(a.type));
  const storedValueAccounts = accounts.filter((a) => a.type === "Stored-value");

  const occurrenceState = new Map(occurrenceRows.map((o) => [`${o.recurring_item_id}|${o.occ_date}`, o]));
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const occurrences = buildOccurrencesForWindow(items, occurrenceState, start, end);

  const byCategory = new Map<string, number>();
  for (const o of occurrences) {
    if (o.skipped) continue;
    const name = o.item.category_id ? (categoriesById.get(o.item.category_id)?.name ?? "Other") : "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + o.amount);
  }
  for (const p of purchases) {
    const name = p.category || "Play";
    byCategory.set(name, (byCategory.get(name) ?? 0) + p.amount);
  }
  const spendingByCategory = Array.from(byCategory.entries())
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({ name, amount, icon: categoriesById.get(name)?.emoji ?? DEFAULT_CATEGORY_ICON }))
    .sort((a, b) => b.amount - a.amount);

  const transactions: TransactionLike[] = purchases.map((p) => ({
    id: p.id,
    name: p.name,
    amount: p.amount,
    date: p.spent_on,
    kind: "outflow",
    category: p.category || null,
  }));
  const groups = groupByDate(transactions);

  return (
    <div className="space-y-6">
      <div className={CARD}>
        <p className={CARD_HEADER}>Log an expense</p>
        <div className="mt-3">
          <LogExpenseForm
            investingAccounts={investingAccounts}
            storedValueAccounts={storedValueAccounts}
            cards={cards.map((c) => ({ id: c.id, name: c.name }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            taxRatePct={settings.tax_rate_pct}
            location={settings.location}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className={CARD}>
          <p className={CARD_HEADER}>This month</p>
          {groups.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={lucideKey("receipt")} title="Nothing logged this month yet" />
            </div>
          ) : (
            <div className={`mt-3 ${SCROLL_LIST}`}>
              <RecentList groups={groups} onRemoveAction={deletePurchase} />
            </div>
          )}
        </div>

        <div className={CARD}>
          <p className={CARD_HEADER}>Where it went</p>
          <div className="mt-3">
            {spendingByCategory.length === 0 ? (
              <p className="text-[13px] text-ink-3">Nothing spent yet this month.</p>
            ) : (
              <SpendingRing data={spendingByCategory} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
