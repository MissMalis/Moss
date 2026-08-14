import { listCategories, listRecurringItems, listOccurrencesInRange } from "@/lib/data/recurring";
import { listIncomeSourcesWithVersions } from "@/lib/data/income";
import {
  createRecurringItem,
  updateRecurringItem,
  toggleRecurringItemActive,
  deleteRecurringItem,
  skipOccurrence,
  unskipOccurrence,
  editOccurrenceOnce,
  postOccurrence,
  unpostOccurrence,
} from "@/lib/actions/recurring";
import { buildOccurrencesForWindow, sumEarmarked } from "@/lib/recurring";
import { windowsAround, findCurrentWindow, findFutureWindows } from "@/lib/today";
import { nextOccurrenceOnOrAfter } from "@/lib/periods";
import { formatMoney, formatDateRange } from "@/lib/format";
import { AddButton } from "@/components/AddButton";
import { EmptyState } from "@/components/EmptyState";
import { IconGlyph } from "@/components/IconGlyph";
import { CountdownBadge } from "@/components/CountdownBadge";
import { RowMenu } from "@/components/RowMenu";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, CARD, CARD_HEADER, EST_BADGE, INPUT, LABEL, ROW, SCROLL_LIST } from "@/lib/ui";

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

  function OccurrenceRow({ o }: { o: (typeof currentPeriodOccurrences)[number] }) {
    const category = o.item.category_id ? categoryById.get(o.item.category_id) : null;
    return (
      <div className={`flex items-center justify-between gap-2 py-2 ${o.skipped ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-2">
          <IconGlyph value={category?.emoji} fallback="🧾" className="text-[14px]" />
          <div>
            <p className="text-[13.5px] text-ink">{o.item.name}</p>
            <CountdownBadge dateISO={o.occDate} todayISO={todayISO} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {o.isEstimate && !o.skipped && <span className={EST_BADGE}>est</span>}
          <span className="w-16 text-right text-[13.5px] text-ink tabular-nums">{formatMoney(o.amount)}</span>
          <RowMenu
            popovers={[
              ...(!o.posted
                ? [
                    {
                      label: "Mark posted",
                      content: (
                        <form action={postOccurrence} className="flex items-center gap-2">
                          <input type="hidden" name="recurring_item_id" value={o.item.id} />
                          <input type="hidden" name="occ_date" value={o.occDate} />
                          {o.item.is_variable && (
                            <input
                              type="number"
                              step="0.01"
                              name="actual_amount"
                              placeholder="Actual amount"
                              defaultValue={o.amount}
                              className={`flex-1 ${INPUT}`}
                            />
                          )}
                          <button type="submit" className={BTN_SOLID}>
                            Confirm
                          </button>
                        </form>
                      ),
                    },
                  ]
                : []),
              {
                label: "Edit once",
                content: (
                  <form action={editOccurrenceOnce} className="flex items-center gap-2">
                    <input type="hidden" name="recurring_item_id" value={o.item.id} />
                    <input type="hidden" name="occ_date" value={o.occDate} />
                    <input
                      type="number"
                      step="0.01"
                      name="override_amount"
                      defaultValue={o.amount}
                      className={`flex-1 ${INPUT}`}
                    />
                    <button type="submit" className={BTN_SOLID}>
                      Save
                    </button>
                  </form>
                ),
              },
            ]}
          >
            {o.posted && (
              <form action={unpostOccurrence}>
                <input type="hidden" name="recurring_item_id" value={o.item.id} />
                <input type="hidden" name="occ_date" value={o.occDate} />
                <button type="submit">Undo posted</button>
              </form>
            )}
            {o.skipped ? (
              <form action={unskipOccurrence}>
                <input type="hidden" name="recurring_item_id" value={o.item.id} />
                <input type="hidden" name="occ_date" value={o.occDate} />
                <button type="submit">Unskip</button>
              </form>
            ) : (
              <form action={skipOccurrence}>
                <input type="hidden" name="recurring_item_id" value={o.item.id} />
                <input type="hidden" name="occ_date" value={o.occDate} />
                <button type="submit">Skip</button>
              </form>
            )}
          </RowMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12.5px] uppercase tracking-wide text-ink-3">{formatDateRange(start, end)}, earmarked</p>
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
                    {c.emoji && !c.emoji.startsWith("data:") ? `${c.emoji} ` : ""}
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
        <div className={CARD}>
          <p className={CARD_HEADER}>Current pay period</p>
          {currentWindow ? (
            <p className="mt-0.5 text-[12px] text-ink-3">{formatDateRange(currentWindow.start, currentWindow.end)}</p>
          ) : null}
          {currentPeriodOccurrences.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">Nothing due this period.</p>
          ) : (
            <div className="mt-1 divide-y divide-border">
              {currentPeriodOccurrences.map((o) => (
                <OccurrenceRow key={`${o.item.id}|${o.occDate}`} o={o} />
              ))}
            </div>
          )}
        </div>

        <div className={CARD}>
          <p className={CARD_HEADER}>Next pay period</p>
          {nextWindow ? (
            <p className="mt-0.5 text-[12px] text-ink-3">{formatDateRange(nextWindow.start, nextWindow.end)}</p>
          ) : null}
          {nextPeriodOccurrences.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">Nothing due next period.</p>
          ) : (
            <div className="mt-1 divide-y divide-border">
              {nextPeriodOccurrences.map((o) => (
                <OccurrenceRow key={`${o.item.id}|${o.occDate}`} o={o} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={CARD}>
        <p className={CARD_HEADER}>All recurring bills</p>
        {items.length === 0 ? (
          <div className="mt-3">
            <EmptyState emoji="📋" title="No recurring bills yet" hint="Add your first one above." />
          </div>
        ) : (
          <div className={`mt-3 space-y-2 ${SCROLL_LIST}`}>
            {items.map((item) => {
              const category = item.category_id ? categoryById.get(item.category_id) : null;
              const nextDate = nextOccurrenceOnOrAfter({ day: item.day_of_month }, todayISO);
              return (
                <div key={item.id} className={ROW}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <IconGlyph value={category?.emoji} fallback="🧾" className="text-[15px]" />
                      <div>
                        <p className={item.active ? "text-[14px] text-ink" : "text-[14px] text-ink-3 line-through"}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <CountdownBadge dateISO={nextDate} todayISO={todayISO} />
                          {category && <span className="text-[12px] text-ink-3">· {category.name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.is_variable && <span className={EST_BADGE}>est</span>}
                      <span className="w-16 text-right text-[14px] text-ink tabular-nums">{formatMoney(item.amount)}</span>
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
                                      {c.emoji && !c.emoji.startsWith("data:") ? `${c.emoji} ` : ""}
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    name="amount"
                                    defaultValue={item.amount}
                                    className={`flex-1 ${INPUT}`}
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    name="day_of_month"
                                    defaultValue={item.day_of_month}
                                    className={`w-16 ${INPUT}`}
                                  />
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
                        <form action={deleteRecurringItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit">Remove</button>
                        </form>
                      </RowMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
