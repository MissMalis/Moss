import { listIncomeSources, listDeductions } from "@/lib/data/income";
import { listAccounts } from "@/lib/data/accounts";
import { deleteIncomeSource, createDeduction, deleteDeduction } from "@/lib/actions/income";
import { formatMoney, describeFrequency } from "@/lib/format";
import { IncomeSourceForm } from "@/components/IncomeSourceForm";
import { EmptyState } from "@/components/EmptyState";
import { Tooltip } from "@/components/Tooltip";
import { BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

export default async function IncomePage() {
  const [incomeSources, deductions, accounts] = await Promise.all([
    listIncomeSources(),
    listDeductions(),
    listAccounts(),
  ]);
  const systemAccounts = accounts.filter((a) => a.is_system && a.system_key);

  return (
    <div className="space-y-10">
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
          {incomeSources.map((s) => (
            <div key={s.id} className={`${ROW} flex flex-wrap items-center justify-between gap-3`}>
              <div>
                <p className="text-[14px] text-ink">{s.name}</p>
                <p className="text-[12.5px] text-ink-2">
                  {formatMoney(s.net_per_check)} · {describeFrequency(s)}
                </p>
              </div>
              <form action={deleteIncomeSource}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className={LINK_QUIET}>
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>

        <details className="mt-4 rounded-[20px] border border-border bg-card p-5">
          <summary className="cursor-pointer text-[13px] text-ink-2">Add income</summary>
          <IncomeSourceForm />
        </details>
      </section>

      <section>
        <h2 className="font-display text-[22px] font-medium text-ink">Contributions</h2>
        <p className="mt-1 text-[13px] text-ink-2">
          401k, HSA, and similar — these reduce take-home for earmarking and post to the matching
          net-worth account, including employer match, once you mark that pay date posted.
          They&apos;ll also show up under &quot;Contributions&quot; in Recurring so you can see the
          whole period at a glance.
        </p>

        <div className="mt-4 space-y-2">
          {deductions.length === 0 && (
            <EmptyState emoji="🏦" title="No contributions set up yet" />
          )}
          {deductions.map((d) => {
            const source = incomeSources.find((s) => s.id === d.income_source_id);
            return (
              <div key={d.id} className={`${ROW} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <p className="text-[14px] text-ink">{d.name}</p>
                  <p className="text-[12.5px] text-ink-2">
                    {source?.name ?? "—"} · {formatMoney(d.amount)}
                    {d.employer_match > 0 && ` + ${formatMoney(d.employer_match)} match`}
                    {d.target_account_key && ` · posts to ${d.target_account_key}`}
                  </p>
                </div>
                <form action={deleteDeduction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className={LINK_QUIET}>
                    Remove
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        {incomeSources.length > 0 && (
          <details className="mt-4 rounded-[20px] border border-border bg-card p-5">
            <summary className="cursor-pointer text-[13px] text-ink-2">Add a contribution</summary>
            <form action={createDeduction} className="mt-3 flex flex-wrap items-end gap-3">
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
                Posts to account
                <Tooltip text="Which net-worth account this credits — you and your employer's match both land here when you mark the pay date posted." />
                <select name="target_account_key" className={INPUT}>
                  <option value="">No posting</option>
                  {systemAccounts.map((a) => (
                    <option key={a.id} value={a.system_key ?? ""}>
                      {a.name} ({a.system_key})
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
          </details>
        )}
      </section>
    </div>
  );
}
