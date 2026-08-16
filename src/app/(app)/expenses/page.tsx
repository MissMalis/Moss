import Link from "next/link";
import { listCategories, listRecurringItems, listOccurrencesInRange } from "@/lib/data/recurring";
import { listIncomeSourcesWithVersions, listPurchasesInRange } from "@/lib/data/income";
import { listBudgets } from "@/lib/data/budgets";
import { listAccounts } from "@/lib/data/accounts";
import { listCards } from "@/lib/data/cards";
import { getSettings } from "@/lib/data/settings";
import { createRecurringItem, updateRecurringItem, toggleRecurringItemActive, deleteRecurringItem } from "@/lib/actions/recurring";
import { buildOccurrencesForWindow, sumEarmarked } from "@/lib/recurring";
import { computeBudgetProgress } from "@/lib/budgets";
import { windowsAround, findCurrentWindow, findFutureWindows } from "@/lib/today";
import { nextOccurrenceOnOrAfter } from "@/lib/periods";
import { formatMoney, formatDateRange } from "@/lib/format";
import { groupByDate, type TransactionLike } from "@/lib/recent-transactions";
import { AddButton } from "@/components/AddButton";
import { EmptyState } from "@/components/EmptyState";
import { IconCircle } from "@/components/IconCircle";
import { CountdownBadge } from "@/components/CountdownBadge";
import { PayPeriodToggle } from "@/components/PayPeriodToggle";
import { BudgetTracker } from "@/components/BudgetTracker";
import { StandardRow } from "@/components/StandardRow";
import { RowMenu } from "@/components/RowMenu";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { RecentList } from "@/components/RecentList";
import { SpendingRing } from "@/components/SpendingRing";
import { LogExpenseForm } from "@/components/LogExpenseForm";
import { Dropdown } from "@/components/Dropdown";
import { Tooltip } from "@/components/Tooltip";
import { buildPayableAccounts } from "@/lib/payable-accounts";
import { lucideKey } from "@/lib/icons";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, LINK_QUIET, SCROLL_LIST } from "@/lib/ui";

const DEFAULT_CATEGORY_ICON = lucideKey("credit-card");

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default async function RecurringBillsPage() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const { start, end } = currentMonthWindow();
  const [categories, items, incomeSources, monthPurchases, budgetRows, accounts, cards, settings] = await Promise.all([
    listCategories(),
    listRecurringItems(),
    listIncomeSourcesWithVersions(),
    listPurchasesInRange(start, end),
    listBudgets(),
    listAccounts(),
    listCards(),
    getSettings(),
  ]);
  const payableAccounts = buildPayableAccounts(accounts, cards);

  const primarySource = incomeSources.find((s) => s.freq !== "one-off") ?? null;
  const windows = primarySource ? windowsAround(primarySource, todayISO) : [];
  const currentWindow = primarySource ? findCurrentWindow(windows, todayISO) : null;
  const nextWindow = currentWindow ? findFutureWindows(windows, currentWindow, 1)[0] : null;

  const scanStart = currentWindow?.start ?? start;
  const scanEnd = nextWindow?.end ?? end;
  const occurrenceRows = await listOccurrencesInRange(scanStart < start ? scanStart : start, scanEnd > end ? scanEnd : end);
  const occurrenceState = new Map(occurrenceRows.map((o) => [`${o.recurring_item_id}|${o.occ_date}`, o]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const monthOccurrences = buildOccurrencesForWindow(items, occurrenceState, start, end);
  const monthEarmarked = sumEarmarked(monthOccurrences);

  const currentPeriodOccurrences = currentWindow
    ? buildOccurrencesForWindow(items, occurrenceState, currentWindow.start, currentWindow.end).sort((a, b) =>
        a.occDate.localeCompare(b.occDate),
      )
    : [];
  const nextPeriodOccurrences = nextWindow
    ? buildOccurrencesForWindow(items, occurrenceState, nextWindow.start, nextWindow.end).sort((a, b) =>
        a.occDate.localeCompare(b.occDate),
      )
    : [];

  // §6: monthly budgets, tracked against this calendar month's checking-sourced spend.
  const budgetProgress = computeBudgetProgress(budgetRows, monthPurchases);

  // §8: "This month's expenses" + "Where it went" — same shared component/data as Dashboard and Sweep.
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const transactions: TransactionLike[] = monthPurchases.map((p) => ({
    id: p.id,
    name: p.name,
    amount: p.amount,
    date: p.spent_on,
    kind: "outflow",
    category: p.category || null,
    categoryIcon: p.category ? (categoryByName.get(p.category)?.emoji ?? null) : null,
    categoryColor: p.category ? (categoryByName.get(p.category)?.color ?? null) : null,
  }));
  const monthGroups = groupByDate(transactions);

  const byCategory = new Map<string, number>();
  for (const o of monthOccurrences) {
    if (o.skipped) continue;
    const name = o.item.category_id ? (categoryById.get(o.item.category_id)?.name ?? "Other") : "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + o.amount);
  }
  for (const p of monthPurchases) {
    // Rev 07 #8: match computeBudgetProgress's scope (checking-sourced
    // purchases only) so the same category never shows two different
    // "spent" totals between the ring and the budget tracker.
    if (p.payment_source !== "checking") continue;
    const name = p.category || "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + p.amount);
  }
  const spendingByCategory = Array.from(byCategory.entries())
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({ name, amount, icon: categoryByName.get(name)?.emoji ?? DEFAULT_CATEGORY_ICON }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12.5px] uppercase tracking-wide text-ink-3">{formatDateRange(start, end)}</p>
          <p className="font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
            {formatMoney(monthEarmarked)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddButton label="+ Log an expense">
            <LogExpenseForm
              payableAccounts={payableAccounts}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              taxRatePct={settings.tax_rate_pct}
              location={settings.location}
            />
          </AddButton>
          <AddButton label="+ Add a bill">
            <form action={createRecurringItem} className="flex flex-wrap items-end gap-3">
              <label className={LABEL}>
                Name
                <input name="name" required className={INPUT} />
              </label>
              <label className={LABEL}>
                Category
                <Dropdown
                  name="category_id"
                  options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                  defaultValue=""
                />
              </label>
              <label className={LABEL}>
                Amount / estimate
                <input type="number" step="0.01" name="amount" defaultValue={0} className={`w-28 ${INPUT}`} />
              </label>
              <label className={LABEL}>
                Day of month
                <input type="number" min={1} max={31} name="day_of_month" defaultValue={1} className={`w-20 ${INPUT}`} />
              </label>
              <label className="flex items-center gap-1 pb-2 text-[12.5px] text-ink-2">
                <input type="checkbox" name="is_variable" />
                Variable
                <Tooltip text="Charges a different amount every time (like PSEG). Carries an estimate that true-ups to the actual once you mark it posted." />
              </label>
              <label className="flex items-center gap-1 pb-2 text-[12.5px] text-ink-2">
                <input type="checkbox" name="apply_tax" />
                Add tax
                <Tooltip text="Applies your location's sales-tax rate (set in Settings) to the amount above." />
              </label>
              <button type="submit" className={BTN_SOLID}>
                Add a bill
              </button>
            </form>
          </AddButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PayPeriodToggle
          current={{ window: currentWindow, occurrences: currentPeriodOccurrences, emptyLabel: "Nothing due this period." }}
          next={{ window: nextWindow, occurrences: nextPeriodOccurrences, emptyLabel: "Nothing due next period." }}
          categoryById={categoryById}
          todayISO={todayISO}
        />
        <BudgetTracker budgets={budgetProgress} categories={categories} />
      </div>

      <div className={CARD}>
        <div className="flex items-center gap-1">
          <p className={CARD_HEADER}>All recurring bills</p>
          <Tooltip text="Mark posted confirms a bill cleared (and for variable bills, records the real amount). Edit once changes just this occurrence. Edit going forward changes the recurring default. Skip releases this occurrence's earmark without posting it." />
        </div>
        {items.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={lucideKey("receipt")} title="No recurring bills yet" hint="Add your first one above." />
          </div>
        ) : (
          <div className={`mt-3 space-y-1 ${SCROLL_LIST}`}>
            {items.map((item) => {
              const category = item.category_id ? categoryById.get(item.category_id) : null;
              const nextDate = nextOccurrenceOnOrAfter({ day: item.day_of_month }, todayISO);
              return (
                <StandardRow
                  key={item.id}
                  leadingIcon={<IconCircle value={item.icon} label={item.name} variant="solid" />}
                  name={item.active ? item.name : `${item.name} (inactive)`}
                  subtitle={<CountdownBadge dateISO={nextDate} todayISO={todayISO} />}
                  categorySymbol={
                    category ? <IconCircle value={category.emoji} label={category.name} color={category.color} variant="tinted" size="sm" /> : null
                  }
                  estBadge={item.is_variable}
                  amountNode={<span className="text-ink">{formatMoney(item.amount)}</span>}
                  dimmed={!item.active}
                  trailing={
                    <RowMenu
                      popovers={[
                        {
                          label: "Edit going forward",
                          content: (
                            <form action={updateRecurringItem} className="flex flex-col gap-2">
                              <input type="hidden" name="id" value={item.id} />
                              <input name="name" defaultValue={item.name} className={INPUT} />
                              <Dropdown
                                name="category_id"
                                options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                                defaultValue={item.category_id ?? ""}
                              />
                              <div className="flex items-center gap-2">
                                <input type="number" step="0.01" name="amount" defaultValue={item.amount} className={`flex-1 ${INPUT}`} />
                                <input type="number" min={1} max={31} name="day_of_month" defaultValue={item.day_of_month} className={`w-16 ${INPUT}`} />
                              </div>
                              <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                                <input type="checkbox" name="is_variable" defaultChecked={item.is_variable} />
                                Variable
                              </label>
                              <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                                <input type="checkbox" name="apply_tax" defaultChecked={item.apply_tax} />
                                Add tax
                              </label>
                              <button type="submit" className={BTN_SOLID}>
                                Save
                              </button>
                            </form>
                          ),
                        },
                      ]}
                    >
                      <form action={toggleRecurringItemActive}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="active" value={(!item.active).toString()} />
                        <button type="submit">{item.active ? "Deactivate" : "Activate"}</button>
                      </form>
                      <ConfirmDeleteButton
                        action={deleteRecurringItem}
                        hiddenFields={{ id: item.id }}
                        itemLabel={item.name}
                        variant="link"
                      />
                    </RowMenu>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className={CARD}>
          <p className={CARD_HEADER}>
            This month&apos;s expenses{" "}
            <Link href="/expenses/log" className={`${LINK_QUIET} ml-1`}>
              Log one →
            </Link>
          </p>
          {monthGroups.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">Nothing logged this month yet.</p>
          ) : (
            <div className={`mt-3 ${SCROLL_LIST}`}>
              <RecentList groups={monthGroups} />
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
