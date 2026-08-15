import { listIncomeSourcesWithVersions, listDeductions, currentIncomeAmount } from "@/lib/data/income";
import { listAccounts } from "@/lib/data/accounts";
import {
  deleteIncomeSource,
  addIncomeAmountVersion,
  createDeduction,
  updateDeduction,
  deleteDeduction,
} from "@/lib/actions/income";
import { formatMoney, describeFrequency, formatShortDateLabel } from "@/lib/format";
import { IncomeSourceForm } from "@/components/IncomeSourceForm";
import { AddButton } from "@/components/AddButton";
import { RowMenu } from "@/components/RowMenu";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { lucideKey } from "@/lib/icons";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL, ROW } from "@/lib/ui";

export default async function IncomePage() {
  const [incomeSources, deductions, accounts] = await Promise.all([
    listIncomeSourcesWithVersions(),
    listDeductions(),
    listAccounts(),
  ]);
  // Rev 04 §5: any account can receive a contribution now — no more
  // separate "fed by paycheck contributions" checkbox gating this list.
  const systemAccounts = accounts.filter((a) => a.system_key);
  const accountByKey = new Map(systemAccounts.map((a) => [a.system_key, a.name]));

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

      <div className={CARD}>
        <div className="flex items-start justify-between">
          <div>
            <p className={CARD_HEADER}>Contributions</p>
            <p className="mt-1 text-[13px] text-ink-2">
              401(k), HSA, and similar — these post to the matching account, including employer match,
              once you mark that pay date posted. Pre-tax contributions never touched your take-home,
              so they don&apos;t reduce Safe to spend; post-tax (Roth) does, since that money already
              landed in checking. They also show up read-only under Contributions in Expenses.
            </p>
          </div>
          {incomeSources.length > 0 && (
            <AddButton label="Add a contribution">
              <form action={createDeduction} className="flex flex-wrap items-end gap-3">
                <label className={LABEL}>
                  Income source
                  <select name="income_source_id" className={INPUT}>
                    {incomeSources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={LABEL}>
                  Name
                  <input name="name" required placeholder="401k" className={INPUT} />
                </label>
                <label className={LABEL}>
                  Your contribution
                  <input type="number" step="0.01" name="amount" defaultValue={0} className={`w-28 ${INPUT}`} />
                </label>
                <label className={LABEL}>
                  Employer match
                  <input type="number" step="0.01" name="employer_match" defaultValue={0} className={`w-28 ${INPUT}`} />
                </label>
                <label className={LABEL}>
                  <span className="flex items-center gap-1">
                    Tax treatment
                    <Tooltip text="Pre-tax (401k, HSA, Traditional IRA) never touched your take-home, so it doesn't reduce Safe to spend. Post-tax (Roth) comes out of money you already received, so it does." />
                  </span>
                  <select name="tax_treatment" defaultValue="pre_tax" className={INPUT}>
                    <option value="pre_tax">Pre-tax</option>
                    <option value="post_tax">Post-tax (Roth)</option>
                  </select>
                </label>
                <label className={LABEL}>
                  <span className="flex items-center gap-1">
                    Posts to account
                    <Tooltip text="Which net-worth account this credits — you and your employer's match both land here when you mark the pay date posted." />
                  </span>
                  <select name="target_account_key" className={INPUT}>
                    <option value="">No posting</option>
                    {systemAccounts.map((a) => (
                      <option key={a.id} value={a.system_key ?? ""}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className={BTN_SOLID}>
                  Add contribution
                </button>
              </form>
              {systemAccounts.length === 0 && (
                <p className="mt-2 text-[12.5px] text-ink-3">
                  No accounts yet to post to — add one on the Net worth tab, or leave this as
                  &quot;No posting&quot;.
                </p>
              )}
            </AddButton>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {deductions.length === 0 && (
            <EmptyState icon={lucideKey("landmark")} title="No contributions set up yet" />
          )}
          {deductions.map((d) => {
            const source = incomeSources.find((s) => s.id === d.income_source_id);
            return (
              <div key={d.id} className={ROW}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[14px] text-ink">{d.name}</p>
                    <p className="text-[12.5px] text-ink-2">
                      {source?.name ?? "—"} · {formatMoney(d.amount)}
                      {d.employer_match > 0 && ` + ${formatMoney(d.employer_match)} match`}
                      {d.target_account_key && ` · posts to ${accountByKey.get(d.target_account_key) ?? d.target_account_key}`}
                      {" · "}
                      {d.tax_treatment === "pre_tax" ? "pre-tax" : "post-tax (Roth)"}
                    </p>
                  </div>
                  <RowMenu
                    popovers={[
                      {
                        label: "Edit",
                        content: (
                          <form action={updateDeduction} className="flex flex-col gap-2">
                            <input type="hidden" name="id" value={d.id} />
                            <input name="name" defaultValue={d.name} placeholder="Name" className={INPUT} />
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                name="amount"
                                defaultValue={d.amount}
                                className={`min-w-0 flex-1 ${INPUT}`}
                              />
                              <input
                                type="number"
                                step="0.01"
                                name="employer_match"
                                defaultValue={d.employer_match}
                                className={`min-w-0 flex-1 ${INPUT}`}
                              />
                            </div>
                            <select name="tax_treatment" defaultValue={d.tax_treatment} className={INPUT}>
                              <option value="pre_tax">Pre-tax</option>
                              <option value="post_tax">Post-tax (Roth)</option>
                            </select>
                            <select name="target_account_key" defaultValue={d.target_account_key ?? ""} className={INPUT}>
                              <option value="">No posting</option>
                              {systemAccounts.map((a) => (
                                <option key={a.id} value={a.system_key ?? ""}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className={BTN_SOLID}>
                              Save
                            </button>
                          </form>
                        ),
                      },
                    ]}
                  >
                    <ConfirmDeleteButton action={deleteDeduction} hiddenFields={{ id: d.id }} itemLabel={d.name} variant="link" />
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
