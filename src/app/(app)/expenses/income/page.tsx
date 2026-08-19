import { listIncomeSourcesWithVersions, currentIncomeAmount } from "@/lib/data/income";
import { listPayPeriodsInRange } from "@/lib/data/history";
import { deleteIncomeSource, addIncomeAmountVersion } from "@/lib/actions/income";
import { formatMoney, describeFrequency, formatShortDateLabel } from "@/lib/format";
import { groupByDate, type TransactionLike } from "@/lib/recent-transactions";
import { IncomeSourceForm } from "@/components/IncomeSourceForm";
import { AddButton } from "@/components/AddButton";
import { RowMenu } from "@/components/RowMenu";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { RecentList } from "@/components/RecentList";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { lucideKey } from "@/lib/icons";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, ROW, SCROLL_LIST } from "@/lib/ui";

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

/**
 * Rev 09 §1.2: Income moved from its own top-level nav page into a
 * Transactions sub-tab — content below is the old /income page verbatim,
 * plus a new "This month's income" list mirroring "This month's expenses"
 * (same shared RecentList/SCROLL_LIST, kind: "income" renders green +$).
 */
export default async function IncomeTab() {
  const { start, end } = currentMonthWindow();
  const [incomeSources, monthPayPeriods] = await Promise.all([
    listIncomeSourcesWithVersions(),
    listPayPeriodsInRange(start, end),
  ]);
  const sourceById = new Map(incomeSources.map((s) => [s.id, s]));

  const monthTransactions: TransactionLike[] = monthPayPeriods
    .filter((pp) => pp.net_income != null)
    .map((pp) => ({
      id: pp.id,
      name: (pp.income_source_id ? sourceById.get(pp.income_source_id)?.name : null) ?? "Paycheck",
      amount: pp.net_income!,
      date: pp.pay_date,
      kind: "income",
      category: null,
    }));
  const monthGroups = groupByDate(monthTransactions);

  return (
    <div className="space-y-6">
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <p className={CARD_HEADER}>Income sources</p>
          <AddButton label="Add income">
            <IncomeSourceForm />
          </AddButton>
        </div>

        <div className="mt-4 space-y-2">
          {incomeSources.length === 0 && (
            <EmptyState
              icon={lucideKey("wallet")}
              title="No income yet"
              hint="Add a paycheck, a side gig, or a one-time deposit above."
            />
          )}
          {incomeSources.map((s) => {
            const current = currentIncomeAmount(s);
            const history = [...s.amountVersions].sort((a, b) =>
              b.effective_date.localeCompare(a.effective_date),
            );
            return (
              <div key={s.id} className={ROW}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] text-ink">{s.name}</p>
                    <p className="text-[12.5px] text-ink-2">
                      {formatMoney(current)} · {describeFrequency(s)}
                    </p>
                  </div>
                  <RowMenu
                    popovers={[
                      {
                        label: "Change amount",
                        content: (
                          <div>
                            <form action={addIncomeAmountVersion} className="flex flex-col gap-2">
                              <input type="hidden" name="income_source_id" value={s.id} />
                              <label className={LABEL}>
                                New amount
                                <input type="number" step="0.01" name="net_per_check" defaultValue={current} className={INPUT} />
                              </label>
                              <label className={LABEL}>
                                <span className="flex items-center gap-1">
                                  Effective
                                  <Tooltip text="Pay periods before this date keep using the old amount — nothing in the past gets rewritten." />
                                </span>
                                <input
                                  type="date"
                                  name="effective_date"
                                  defaultValue={new Date().toISOString().slice(0, 10)}
                                  className={INPUT}
                                />
                              </label>
                              <button type="submit" className={BTN_SOLID}>
                                Save
                              </button>
                            </form>
                            {history.length > 1 && (
                              <div className="mt-3 space-y-0.5 border-t border-border pt-2">
                                {history.map((v) => (
                                  <p key={v.effective_date} className="text-[12px] text-ink-3">
                                    {formatMoney(v.net_per_check)} from {formatShortDateLabel(v.effective_date)}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  >
                    <ConfirmDeleteButton action={deleteIncomeSource} hiddenFields={{ id: s.id }} itemLabel={s.name} variant="link" />
                  </RowMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={CARD}>
        <p className={CARD_HEADER}>This month&apos;s income</p>
        <div className={`mt-3 ${SCROLL_LIST}`}>
          {monthGroups.length === 0 ? (
            <p className="text-[13px] text-ink-3">Nothing posted this month yet.</p>
          ) : (
            <RecentList groups={monthGroups} />
          )}
        </div>
      </div>
    </div>
  );
}
