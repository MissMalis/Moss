import Link from "next/link";
import { listCategories, listRecurringItems, listOccurrencesInRange } from "@/lib/data/recurring";
import { listIncomeSources, listDeductions, listPurchasesInRange } from "@/lib/data/income";
import { listAccounts } from "@/lib/data/accounts";
import { deletePurchase, loadStoredValue } from "@/lib/actions/income";
import { LogExpenseForm } from "@/components/LogExpenseForm";
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
import { formatMoney, formatDateRange, formatShortDateLabel } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

const INVESTING_TYPES = new Set(["HSA", "401(k)", "Roth IRA", "Traditional IRA", "Taxable Brokerage"]);

export default async function ExpensesPage() {
  const { start, end } = currentMonthWindow();
  const [categories, items, occurrenceRows, deductions, incomeSources, purchases, accounts] =
    await Promise.all([
      listCategories(),
      listRecurringItems(),
      listOccurrencesInRange(start, end),
      listDeductions(),
      listIncomeSources(),
      listPurchasesInRange(start, end),
      listAccounts(),
    ]);

  const investingAccounts = accounts.filter((a) => INVESTING_TYPES.has(a.type));
  const storedValueAccounts = accounts.filter((a) => a.type === "Stored-value");
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const occurrenceState = new Map(
    occurrenceRows.map((o) => [`${o.recurring_item_id}|${o.occ_date}`, o]),
  );
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const occurrences = buildOccurrencesForWindow(items, occurrenceState, start, end).sort(
    (a, b) => a.occDate.localeCompare(b.occDate),
  );
  const earmarked = sumEarmarked(occurrences);
  const contributionsTotal = deductions.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-[12.5px] uppercase tracking-wide text-ink-3">
          This month, earmarked
        </p>
        <p className="font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          {formatMoney(earmarked + contributionsTotal)}
        </p>
      </section>

      <h1 className="font-display text-[13px] uppercase tracking-wide text-ink-3">
        Zone 1 — Recurring bills &amp; subscriptions
      </h1>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">
          {formatDateRange(start, end)}
        </h2>

        {occurrences.length === 0 ? (
          <EmptyState emoji="🧾" title="No bills fall in this window" />
        ) : (
          <div className="space-y-2">
            {occurrences.map((o) => {
              const category = o.item.category_id ? categoryById.get(o.item.category_id) : null;
              return (
                <div key={`${o.item.id}|${o.occDate}`} className={`${ROW} ${o.skipped ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] text-ink">
                        {category?.emoji && <span className="mr-1">{category.emoji}</span>}
                        {o.item.name}{" "}
                        {o.item.is_variable && (
                          <span className="text-[11.5px] text-ink-3">(variable)</span>
                        )}
                      </p>
                      <p className="text-[12px] text-ink-3">
                        {formatShortDateLabel(o.occDate)}
                        {category && ` · ${category.name}`}
                        {o.skipped && " · skipped"}
                        {o.overridden && " · edited once"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[14px] text-ink" title={o.isEstimate ? "estimate" : "actual"}>
                        {formatMoney(o.amount)}
                        {o.isEstimate && !o.skipped && (
                          <span className="ml-1 text-[11.5px] text-ink-3">est.</span>
                        )}
                      </span>

                      {!o.posted ? (
                        <form action={postOccurrence} className="flex items-center gap-1.5">
                          <input type="hidden" name="recurring_item_id" value={o.item.id} />
                          <input type="hidden" name="occ_date" value={o.occDate} />
                          {o.item.is_variable && (
                            <input
                              type="number"
                              step="0.01"
                              name="actual_amount"
                              placeholder="actual"
                              className={`w-20 py-1 text-right text-[12.5px] ${INPUT}`}
                            />
                          )}
                          <button type="submit" className={LINK_QUIET}>
                            Mark posted
                          </button>
                        </form>
                      ) : (
                        <form action={unpostOccurrence}>
                          <input type="hidden" name="recurring_item_id" value={o.item.id} />
                          <input type="hidden" name="occ_date" value={o.occDate} />
                          <button type="submit" className={LINK_QUIET}>
                            Undo posted
                          </button>
                        </form>
                      )}

                      {o.skipped ? (
                        <form action={unskipOccurrence}>
                          <input type="hidden" name="recurring_item_id" value={o.item.id} />
                          <input type="hidden" name="occ_date" value={o.occDate} />
                          <button type="submit" className={LINK_QUIET}>
                            Unskip
                          </button>
                        </form>
                      ) : (
                        <form action={skipOccurrence}>
                          <input type="hidden" name="recurring_item_id" value={o.item.id} />
                          <input type="hidden" name="occ_date" value={o.occDate} />
                          <button type="submit" className={LINK_QUIET}>
                            Skip
                          </button>
                        </form>
                      )}

                      <details>
                        <summary className="cursor-pointer text-[13px] text-ink-3 hover:text-ink-2">
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
                            className={`w-24 py-1 text-right text-[12.5px] ${INPUT}`}
                          />
                          <button type="submit" className={LINK_QUIET}>
                            Save
                          </button>
                        </form>
                      </details>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-[22px] font-medium text-ink">Contributions</h2>
        <p className="mt-1 text-[13px] text-ink-2">
          Posts automatically when you mark a pay date posted on Today.{" "}
          <Link href="/income" className="text-ink-2 underline decoration-border-strong hover:text-ink">
            Manage in Income
          </Link>
          .
        </p>
        <div className="mt-3 space-y-2">
          {deductions.length === 0 ? (
            <EmptyState emoji="🏦" title="No contributions set up" />
          ) : (
            deductions.map((d) => {
              const source = incomeSources.find((s) => s.id === d.income_source_id);
              return (
                <div key={d.id} className={`${ROW} flex items-center justify-between`}>
                  <div>
                    <p className="text-[14px] text-ink">{d.name}</p>
                    <p className="text-[12px] text-ink-3">{source?.name ?? "—"}</p>
                  </div>
                  <span className="text-[14px] text-ink">{formatMoney(d.amount)}</span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Recurring bills</h2>

        {items.length === 0 ? (
          <EmptyState emoji="📋" title="No recurring bills yet" hint="Add your first one below." />
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const category = item.category_id ? categoryById.get(item.category_id) : null;
              return (
                <div key={item.id} className={ROW}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={item.active ? "text-[14px] text-ink" : "text-[14px] text-ink-3 line-through"}>
                        {category?.emoji && <span className="mr-1">{category.emoji}</span>}
                        {item.name}
                      </p>
                      <p className="text-[12px] text-ink-3">
                        Day {item.day_of_month} · {item.is_variable ? "variable" : "fixed"} · default{" "}
                        {formatMoney(item.amount)}
                        {category && ` · ${category.name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <form action={toggleRecurringItemActive}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="active" value={(!item.active).toString()} />
                        <button type="submit" className={LINK_QUIET}>
                          {item.active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <form action={deleteRecurringItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className={LINK_QUIET}>
                          Remove
                        </button>
                      </form>
                      <details>
                        <summary className="cursor-pointer text-[13px] text-ink-3 hover:text-ink-2">
                          Edit going forward
                        </summary>
                        <form action={updateRecurringItem} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            name="name"
                            defaultValue={item.name}
                            className={`py-1 text-[12.5px] ${INPUT}`}
                          />
                          <select
                            name="category_id"
                            defaultValue={item.category_id ?? ""}
                            className={`py-1 text-[12.5px] ${INPUT}`}
                          >
                            <option value="">No category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.emoji ? `${c.emoji} ` : ""}
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            name="amount"
                            defaultValue={item.amount}
                            className={`w-20 py-1 text-right text-[12.5px] ${INPUT}`}
                          />
                          <input
                            type="number"
                            min={1}
                            max={31}
                            name="day_of_month"
                            defaultValue={item.day_of_month}
                            className={`w-14 py-1 text-right text-[12.5px] ${INPUT}`}
                          />
                          <label className="flex items-center gap-1 text-[12px] text-ink-2">
                            <input type="checkbox" name="is_variable" defaultChecked={item.is_variable} />
                            variable
                          </label>
                          <button type="submit" className={`${BTN_SOLID} px-3 py-1.5`}>
                            Save
                          </button>
                        </form>
                      </details>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4 rounded-xl border border-border bg-card p-5">
          <summary className="cursor-pointer text-[13px] text-ink-2">Add a bill</summary>
          <form action={createRecurringItem} className="mt-3 flex flex-wrap items-end gap-3">
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
                    {c.emoji ? `${c.emoji} ` : ""}
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
        </details>
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <form key={c.id} action={deleteCategory} className="flex items-center gap-1">
              <input type="hidden" name="id" value={c.id} />
              <span className="rounded-full border border-border px-3 py-1 text-[13px] text-ink-2">
                {c.emoji && <span className="mr-1">{c.emoji}</span>}
                {c.name}
              </span>
              <button type="submit" className="text-[12px] text-ink-3 hover:text-ink">
                ×
              </button>
            </form>
          ))}
        </div>
        <form action={createCategory} className="mt-3 flex items-end gap-2">
          <input
            name="emoji"
            placeholder="🍔"
            maxLength={4}
            className={`w-14 text-center ${INPUT}`}
          />
          <input name="name" placeholder="New category" required className={INPUT} />
          <button type="submit" className={BTN_SOLID}>
            Add category
          </button>
        </form>
      </section>

      <h2 className="font-display text-[13px] uppercase tracking-wide text-ink-3">
        Zone 2 — Log a one-off expense
      </h2>

      <section>
        <LogExpenseForm investingAccounts={investingAccounts} storedValueAccounts={storedValueAccounts} />

        {purchases.length === 0 ? (
          <EmptyState emoji="🧋" title="Nothing logged this month yet" />
        ) : (
          <div className="mt-4 space-y-1.5">
            {purchases.map((p) => {
              const sourceAccount = p.source_account_id ? accountById.get(p.source_account_id) : null;
              return (
                <div key={p.id} className={`${ROW} flex items-center justify-between`}>
                  <span className="text-[13.5px] text-ink">
                    {p.name}{" "}
                    <span className="text-ink-3">
                      · {formatShortDateLabel(p.spent_on)} · {p.category}
                      {p.payment_source !== "checking" && sourceAccount && ` · ${sourceAccount.name}`}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[13.5px] text-ink tabular-nums">{formatMoney(p.amount)}</span>
                    <form action={deletePurchase}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className={LINK_QUIET}>
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {storedValueAccounts.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Load a stored-value card</h2>
          <p className="mb-3 text-[13px] text-ink-2">
            Funding the card from checking is the one Safe-to-Spend hit — spending it down later isn&apos;t.
          </p>
          <form action={loadStoredValue} className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Card
              <select name="account_id" className={INPUT}>
                {storedValueAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatMoney(a.balance)})
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Amount
              <input type="number" step="0.01" name="amount" required className={`w-28 ${INPUT}`} />
            </label>
            <button type="submit" className={BTN_SOLID}>
              Load it
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
