import { listCategories, listRecurringItems, listOccurrencesInRange } from "@/lib/data/recurring";
import { listIncomeSourcesWithVersions } from "@/lib/data/income";
import { createRecurringItem, updateRecurringItem, toggleRecurringItemActive, deleteRecurringItem } from "@/lib/actions/recurring";
import { buildOccurrencesForWindow, sumEarmarked } from "@/lib/recurring";
import { windowsAround, findCurrentWindow, findFutureWindows } from "@/lib/today";
import { nextOccurrenceOnOrAfter } from "@/lib/periods";
import { formatMoney, formatDateRange } from "@/lib/format";
import { AddButton } from "@/components/AddButton";
import { EmptyState } from "@/components/EmptyState";
import { IconCircle } from "@/components/IconCircle";
import { CountdownBadge } from "@/components/CountdownBadge";
import { CurrentPeriodCard } from "@/components/CurrentPeriodCard";
import { StandardRow } from "@/components/StandardRow";
import { RowMenu } from "@/components/RowMenu";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Tooltip } from "@/components/Tooltip";
import { lucideKey } from "@/lib/icons";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, SCROLL_LIST } from "@/lib/ui";

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default async function RecurringBillsPage() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const { start, end } = currentMonthWindow();
  const [categories, items, incomeSources] = await Promise.all([
    listCategories(),
    listRecurringItems(),
    listIncomeSourcesWithVersions(),
  ]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12.5px] uppercase tracking-wide text-ink-3">{formatDateRange(start, end)}</p>
          <p className="font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
            {formatMoney(monthEarmarked)}
          </p>
        </div>
        <AddButton label="Add a bill">
          <form action={createRecurringItem} className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Name
              <input name="name" required className={INPUT} />
            </label>
            <label className={LABEL}>
              Category
              <select name="category_id" className={INPUT}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
            <button type="submit" className={BTN_SOLID}>
              Add a bill
            </button>
          </form>
        </AddButton>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CurrentPeriodCard
          title="Current pay period"
          window={currentWindow}
          occurrences={currentPeriodOccurrences}
          categoryById={categoryById}
          todayISO={todayISO}
          emptyLabel="Nothing due this period."
        />
        <CurrentPeriodCard
          title="Next pay period"
          window={nextWindow}
          occurrences={nextPeriodOccurrences}
          categoryById={categoryById}
          todayISO={todayISO}
          emptyLabel="Nothing due next period."
        />
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
                              <select name="category_id" defaultValue={item.category_id ?? ""} className={INPUT}>
                                <option value="">No category</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex items-center gap-2">
                                <input type="number" step="0.01" name="amount" defaultValue={item.amount} className={`flex-1 ${INPUT}`} />
                                <input type="number" min={1} max={31} name="day_of_month" defaultValue={item.day_of_month} className={`w-16 ${INPUT}`} />
                              </div>
                              <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                                <input type="checkbox" name="is_variable" defaultChecked={item.is_variable} />
                                Variable
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
    </div>
  );
}
