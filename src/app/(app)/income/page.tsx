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
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

export default async function IncomePage() {
  const [incomeSources, deductions, accounts] = await Promise.all([
    listIncomeSourcesWithVersions(),
    listDeductions(),
    listAccounts(),
  ]);
  const systemAccounts = accounts.filter((a) => a.is_system && a.system_key);
  const accountByKey = new Map(systemAccounts.map((a) => [a.system_key, a.name]));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-[28px] font-medium text-ink">Income</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          The first stream you add sets the pay-period rhythm the rest of Moss follows.
        </p>

        <div className="mt-4 space-y-2">
          {incomeSources.length === 0 && (
            <EmptyState
              emoji="💵"
              title="No income yet"
              hint="Add a paycheck, a side gig, or a one-time deposit below."
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
                  <form action={deleteIncomeSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className={LINK_QUIET}>
                      Remove
                    </button>
                  </form>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                    Change amount (a raise, say)
                  </summary>
                  <form action={addIncomeAmountVersion} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="income_source_id" value={s.id} />
                    <label className={LABEL}>
                      New amount
                      <input
                        type="number"
                        step="0.01"
                        name="net_per_check"
                        defaultValue={current}
                        className={`w-28 ${INPUT}`}
                      />
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
                    <button type="submit" className={LINK_QUIET}>
                      Save
                    </button>
                  </form>
                  {history.length > 1 && (
                    <div className="mt-2 space-y-0.5">
                      {history.map((v) => (
                        <p key={v.effective_date} className="text-[12px] text-ink-3">
                          {formatMoney(v.net_per_check)} from {formatShortDateLabel(v.effective_date)}
                        </p>
                      ))}
                    </div>
                  )}
                </details>
              </div>
            );
          })}
        </div>

        <AddButton label="Add income">
          <IncomeSourceForm />
        </AddButton>
      </section>

      <section>
        <h2 className="font-display text-[22px] font-medium text-ink">Contributions</h2>
        <p className="mt-1 text-[13px] text-ink-2">
          401k, HSA, and similar — these post to the matching account, including employer match,
          once you mark that pay date posted. Pre-tax contributions never touched your take-home,
          so they don&apos;t reduce Safe to spend; post-tax (Roth) does, since that money already
          landed in checking. They&apos;ll also show up under &quot;Contributions&quot; in Expenses
          so you can see the whole period at a glance.
        </p>

        <div className="mt-4 space-y-2">
          {deductions.length === 0 && (
            <EmptyState emoji="🏦" title="No contributions set up yet" />
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
                  <form action={deleteDeduction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className={LINK_QUIET}>
                      Remove
                    </button>
                  </form>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                    Edit
                  </summary>
                  <form action={updateDeduction} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <label className={LABEL}>
                      Name
                      <input name="name" defaultValue={d.name} className={INPUT} />
                    </label>
                    <label className={LABEL}>
                      Contribution
                      <input
                        type="number"
                        step="0.01"
                        name="amount"
                        defaultValue={d.amount}
                        className={`w-24 ${INPUT}`}
                      />
                    </label>
                    <label className={LABEL}>
                      Match
                      <input
                        type="number"
                        step="0.01"
                        name="employer_match"
                        defaultValue={d.employer_match}
                        className={`w-24 ${INPUT}`}
                      />
                    </label>
                    <label className={LABEL}>
                      Tax treatment
                      <select name="tax_treatment" defaultValue={d.tax_treatment} className={INPUT}>
                        <option value="pre_tax">Pre-tax</option>
                        <option value="post_tax">Post-tax (Roth)</option>
                      </select>
                    </label>
                    <label className={LABEL}>
                      Posts to
                      <select
                        name="target_account_key"
                        defaultValue={d.target_account_key ?? ""}
                        className={INPUT}
                      >
                        <option value="">No posting</option>
                        {systemAccounts.map((a) => (
                          <option key={a.id} value={a.system_key ?? ""}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className={LINK_QUIET}>
                      Save
                    </button>
                  </form>
                </details>
              </div>
            );
          })}
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
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  defaultValue={0}
                  className={`w-28 ${INPUT}`}
                />
              </label>
              <label className={LABEL}>
                Employer match
                <input
                  type="number"
                  step="0.01"
                  name="employer_match"
                  defaultValue={0}
                  className={`w-28 ${INPUT}`}
                />
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
                No accounts are marked to receive contributions yet — set one up as &quot;fed by
                paycheck contributions&quot; on the Net worth tab, or leave this as &quot;No
                posting&quot;.
              </p>
            )}
          </AddButton>
        )}
      </section>
    </div>
  );
}
