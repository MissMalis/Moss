import { listIncomeSourcesWithVersions, currentIncomeAmount } from "@/lib/data/income";
import { deleteIncomeSource, addIncomeAmountVersion } from "@/lib/actions/income";
import { formatMoney, describeFrequency, formatShortDateLabel } from "@/lib/format";
import { IncomeSourceForm } from "@/components/IncomeSourceForm";
import { AddButton } from "@/components/AddButton";
import { RowMenu } from "@/components/RowMenu";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { lucideKey } from "@/lib/icons";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, ROW } from "@/lib/ui";

/** Rev 06b §5: Income holds only paychecks now — contributions live on each account's own Net worth detail page. */
export default async function IncomePage() {
  const incomeSources = await listIncomeSourcesWithVersions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Income</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          The first stream you add sets the pay-period rhythm the rest of Moss follows.
        </p>
      </div>

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
    </div>
  );
}
