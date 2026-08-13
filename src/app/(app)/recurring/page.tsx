import { listCategories, listRecurringItems } from "@/lib/data/recurring";
import { listOccurrencesInRange } from "@/lib/data/recurring";
import { buildOccurrencesForWindow, sumEarmarked } from "@/lib/recurring";
import {
  createCategory,
  deleteCategory,
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

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export default async function RecurringPage() {
  const { start, end } = currentMonthWindow();
  const [categories, items, occurrenceRows] = await Promise.all([
    listCategories(),
    listRecurringItems(),
    listOccurrencesInRange(start, end),
  ]);

  const occurrenceState = new Map(
    occurrenceRows.map((o) => [`${o.recurring_item_id}|${o.occ_date}`, o]),
  );
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));

  const occurrences = buildOccurrencesForWindow(items, occurrenceState, start, end).sort(
    (a, b) => a.occDate.localeCompare(b.occDate),
  );
  const earmarked = sumEarmarked(occurrences);

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm uppercase tracking-wide text-dim">This month, earmarked</p>
        <p className="font-display text-5xl text-gold">{money(earmarked)}</p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl text-text">Occurrences ({start} – {end})</h2>
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {occurrences.length === 0 && (
            <p className="p-4 text-sm text-faint">No bills fall in this window.</p>
          )}
          {occurrences.map((o) => (
            <div
              key={`${o.item.id}|${o.occDate}`}
              className={`flex flex-wrap items-center justify-between gap-3 p-4 ${o.skipped ? "opacity-50" : ""}`}
            >
              <div>
                <p className="text-text">
                  {o.item.name}{" "}
                  {o.item.is_variable && (
                    <span className="text-xs text-faint">(variable)</span>
                  )}
                </p>
                <p className="text-xs text-faint">
                  {o.occDate}
                  {o.item.category_id && ` · ${categoryById.get(o.item.category_id) ?? ""}`}
                  {o.skipped && " · skipped"}
                  {o.overridden && " · edited once"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-sm ${o.posted ? "text-sage" : "text-dim"}`}
                  title={o.isEstimate ? "estimate" : "actual"}
                >
                  {money(o.amount)}
                  {o.isEstimate && !o.skipped && (
                    <span className="ml-1 text-xs text-faint">est.</span>
                  )}
                </span>

                {!o.posted ? (
                  <form action={postOccurrence} className="flex items-center gap-1">
                    <input type="hidden" name="recurring_item_id" value={o.item.id} />
                    <input type="hidden" name="occ_date" value={o.occDate} />
                    {o.item.is_variable && (
                      <input
                        type="number"
                        step="0.01"
                        name="actual_amount"
                        placeholder="actual"
                        className="w-24 rounded-md border border-line bg-panel2 px-2 py-1 text-right text-sm text-text outline-none focus:border-gold"
                      />
                    )}
                    <button type="submit" className="text-sm text-sage hover:underline">
                      Post
                    </button>
                  </form>
                ) : (
                  <form action={unpostOccurrence}>
                    <input type="hidden" name="recurring_item_id" value={o.item.id} />
                    <input type="hidden" name="occ_date" value={o.occDate} />
                    <button type="submit" className="text-sm text-dim hover:underline">
                      Unpost
                    </button>
                  </form>
                )}

                {o.skipped ? (
                  <form action={unskipOccurrence}>
                    <input type="hidden" name="recurring_item_id" value={o.item.id} />
                    <input type="hidden" name="occ_date" value={o.occDate} />
                    <button type="submit" className="text-sm text-dim hover:underline">
                      Unskip
                    </button>
                  </form>
                ) : (
                  <form action={skipOccurrence}>
                    <input type="hidden" name="recurring_item_id" value={o.item.id} />
                    <input type="hidden" name="occ_date" value={o.occDate} />
                    <button type="submit" className="text-sm text-faint hover:text-warn">
                      Skip
                    </button>
                  </form>
                )}

                <details>
                  <summary className="cursor-pointer text-sm text-faint hover:text-text">
                    Edit once
                  </summary>
                  <form action={editOccurrenceOnce} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="recurring_item_id" value={o.item.id} />
                    <input type="hidden" name="occ_date" value={o.occDate} />
                    <input
                      type="number"
                      step="0.01"
                      name="override_amount"
                      defaultValue={o.amount}
                      className="w-24 rounded-md border border-line bg-panel2 px-2 py-1 text-right text-sm text-text outline-none focus:border-gold"
                    />
                    <button type="submit" className="text-sm text-sage hover:underline">
                      Save
                    </button>
                  </form>
                </details>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl text-text">Recurring bills</h2>
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className={item.active ? "text-text" : "text-faint line-through"}>
                  {item.name}
                </p>
                <p className="text-xs text-faint">
                  Day {item.day_of_month} · {item.is_variable ? "variable" : "fixed"} · default{" "}
                  {money(item.amount)}
                  {item.category_id && ` · ${categoryById.get(item.category_id) ?? ""}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <form action={toggleRecurringItemActive}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value={(!item.active).toString()} />
                  <button type="submit" className="text-sm text-dim hover:underline">
                    {item.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <form action={deleteRecurringItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="text-sm text-faint hover:text-warn">
                    Remove
                  </button>
                </form>
                <details>
                  <summary className="cursor-pointer text-sm text-faint hover:text-text">
                    Edit going forward
                  </summary>
                  <form
                    action={updateRecurringItem}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      name="name"
                      defaultValue={item.name}
                      className="rounded-md border border-line bg-panel2 px-2 py-1 text-sm text-text outline-none focus:border-gold"
                    />
                    <select
                      name="category_id"
                      defaultValue={item.category_id ?? ""}
                      className="rounded-md border border-line bg-panel2 px-2 py-1 text-sm text-text outline-none focus:border-gold"
                    >
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      name="amount"
                      defaultValue={item.amount}
                      className="w-24 rounded-md border border-line bg-panel2 px-2 py-1 text-right text-sm text-text outline-none focus:border-gold"
                    />
                    <input
                      type="number"
                      min={1}
                      max={31}
                      name="day_of_month"
                      defaultValue={item.day_of_month}
                      className="w-16 rounded-md border border-line bg-panel2 px-2 py-1 text-right text-sm text-text outline-none focus:border-gold"
                    />
                    <label className="flex items-center gap-1 text-xs text-faint">
                      <input
                        type="checkbox"
                        name="is_variable"
                        defaultChecked={item.is_variable}
                      />
                      variable
                    </label>
                    <button
                      type="submit"
                      className="rounded-md bg-blood px-3 py-1 text-sm text-text hover:bg-blood-light"
                    >
                      Save
                    </button>
                  </form>
                </details>
              </div>
            </div>
          ))}
        </div>

        <details className="mt-4 rounded-lg border border-line bg-panel p-4">
          <summary className="cursor-pointer text-sm text-dim">Add recurring bill</summary>
          <form action={createRecurringItem} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-faint">
              Name
              <input
                name="name"
                required
                className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Category
              <select
                name="category_id"
                className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Amount / estimate
              <input
                type="number"
                step="0.01"
                name="amount"
                defaultValue={0}
                className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Day of month
              <input
                type="number"
                min={1}
                max={31}
                name="day_of_month"
                defaultValue={1}
                className="w-20 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-faint pb-2">
              <input type="checkbox" name="is_variable" />
              variable
            </label>
            <button
              type="submit"
              className="rounded-md bg-blood px-4 py-1.5 text-sm text-text hover:bg-blood-light"
            >
              Add
            </button>
          </form>
        </details>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl text-text">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <form key={c.id} action={deleteCategory} className="flex items-center gap-1">
              <input type="hidden" name="id" value={c.id} />
              <span className="rounded-full border border-line px-3 py-1 text-sm text-dim">
                {c.name}
              </span>
              <button type="submit" className="text-xs text-faint hover:text-warn">
                ×
              </button>
            </form>
          ))}
        </div>
        <form action={createCategory} className="mt-3 flex items-end gap-2">
          <input
            name="name"
            placeholder="New category"
            required
            className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="rounded-md bg-blood px-3 py-1.5 text-sm text-text hover:bg-blood-light"
          >
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
