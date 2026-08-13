import { listIncomeSources, listDeductions } from "@/lib/data/income";
import { listAccounts } from "@/lib/data/accounts";
import {
  createIncomeSource,
  deleteIncomeSource,
  createDeduction,
  deleteDeduction,
} from "@/lib/actions/income";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function SettingsPage() {
  const [incomeSources, deductions, accounts] = await Promise.all([
    listIncomeSources(),
    listDeductions(),
    listAccounts(),
  ]);
  const systemAccounts = accounts.filter((a) => a.is_system && a.system_key);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 font-display text-2xl text-text">Income sources</h2>
        <p className="mb-3 text-sm text-faint">
          The first income source you add drives the pay-period window that Safe to Spend is
          computed against.
        </p>
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {incomeSources.length === 0 && (
            <p className="p-4 text-sm text-faint">No income sources yet.</p>
          )}
          {incomeSources.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-text">{s.name}</p>
                <p className="text-xs text-faint">
                  {money(s.net_per_check)} · {s.freq}
                  {s.freq === "semimonthly"
                    ? ` (${s.sm_day1} & ${s.sm_day2})`
                    : ` (anchor ${s.anchor_date})`}
                </p>
              </div>
              <form action={deleteIncomeSource}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="text-sm text-faint hover:text-warn">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>

        <details className="mt-4 rounded-lg border border-line bg-panel p-4">
          <summary className="cursor-pointer text-sm text-dim">Add income source</summary>
          <form action={createIncomeSource} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-faint">
              Name
              <input
                name="name"
                required
                className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Net per check
              <input
                type="number"
                step="0.01"
                name="net_per_check"
                defaultValue={0}
                className="w-32 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Frequency
              <select
                name="freq"
                className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              >
                <option value="biweekly">Biweekly</option>
                <option value="semimonthly">Semimonthly</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Anchor payday (biweekly)
              <input
                type="date"
                name="anchor_date"
                className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Semimonthly day 1
              <input
                type="number"
                min={1}
                max={28}
                name="sm_day1"
                defaultValue={1}
                className="w-20 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Semimonthly day 2
              <input
                type="number"
                min={2}
                max={28}
                name="sm_day2"
                defaultValue={16}
                className="w-20 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
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
        <h2 className="mb-3 font-display text-2xl text-text">Deductions</h2>
        <p className="mb-3 text-sm text-faint">
          Contributions (401k, HSA, etc.) reduce take-home for earmarking and post to the matching
          net-worth account, including employer match, when you post that pay date.
        </p>
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {deductions.length === 0 && (
            <p className="p-4 text-sm text-faint">No deductions yet.</p>
          )}
          {deductions.map((d) => {
            const source = incomeSources.find((s) => s.id === d.income_source_id);
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-text">{d.name}</p>
                  <p className="text-xs text-faint">
                    {source?.name ?? "—"} · {money(d.amount)}
                    {d.employer_match > 0 && ` + ${money(d.employer_match)} match`}
                    {d.target_account_key && ` · posts to ${d.target_account_key}`}
                  </p>
                </div>
                <form action={deleteDeduction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="text-sm text-faint hover:text-warn">
                    Remove
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        {incomeSources.length > 0 && (
          <details className="mt-4 rounded-lg border border-line bg-panel p-4">
            <summary className="cursor-pointer text-sm text-dim">Add deduction</summary>
            <form action={createDeduction} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-faint">
                Income source
                <select
                  name="income_source_id"
                  className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                >
                  {incomeSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Name
                <input
                  name="name"
                  required
                  placeholder="401k"
                  className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Your contribution
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  defaultValue={0}
                  className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Employer match
                <input
                  type="number"
                  step="0.01"
                  name="employer_match"
                  defaultValue={0}
                  className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Posts to account
                <select
                  name="target_account_key"
                  className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                >
                  <option value="">No posting</option>
                  {systemAccounts.map((a) => (
                    <option key={a.id} value={a.system_key ?? ""}>
                      {a.name} ({a.system_key})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md bg-blood px-4 py-1.5 text-sm text-text hover:bg-blood-light"
              >
                Add
              </button>
            </form>
            {systemAccounts.length === 0 && (
              <p className="mt-2 text-xs text-faint">
                No system accounts yet — mark an account &quot;system&quot; with a system_key
                (e.g. &quot;hsa&quot;) directly in Supabase to post contributions to it, or leave
                &quot;No posting&quot;.
              </p>
            )}
          </details>
        )}
      </section>
    </div>
  );
}
