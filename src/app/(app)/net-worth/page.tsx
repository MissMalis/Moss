import { listAccounts, listHoldings, ACCOUNT_TYPES } from "@/lib/data/accounts";
import { computeNetWorth } from "@/lib/net-worth";
import { createAccount, deleteAccount, updateAccountBalance } from "@/lib/actions/accounts";
import { createHolding, deleteHolding, updateHoldingPrice } from "@/lib/actions/holdings";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function NetWorthPage() {
  const [accounts, holdings] = await Promise.all([listAccounts(), listHoldings()]);
  const netWorth = computeNetWorth(accounts, holdings);
  const holdingsByAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    if (!h.account_id) continue;
    holdingsByAccount.set(h.account_id, [...(holdingsByAccount.get(h.account_id) ?? []), h]);
  }
  const investmentAccounts = accounts.filter((a) =>
    ["Roth IRA", "Traditional IRA", "Taxable Brokerage", "HSA"].includes(a.type),
  );

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm uppercase tracking-wide text-dim">Net Worth</p>
        <p
          className={`font-display text-6xl ${netWorth.total >= 0 ? "text-gold" : "text-blood-light"}`}
        >
          {money(netWorth.total)}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-dim">
          {ACCOUNT_TYPES.map((t) =>
            netWorth.byType[t] !== undefined ? (
              <span key={t} className="rounded-full border border-line px-3 py-1">
                {t}: <span className="text-text">{money(netWorth.byType[t])}</span>
              </span>
            ) : null,
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl text-text">Accounts</h2>
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {accounts.length === 0 && (
            <p className="p-4 text-sm text-faint">No accounts yet.</p>
          )}
          {accounts.map((a) => {
            const accountHoldings = holdingsByAccount.get(a.id) ?? [];
            const valuedByHoldings = accountHoldings.length > 0;
            return (
              <div key={a.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-text">{a.name}</p>
                    <p className="text-xs text-faint">{a.type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {valuedByHoldings ? (
                      <span className="text-sm text-dim">
                        {money(accountHoldings.reduce((s, h) => s + h.qty * h.current_price, 0))}{" "}
                        (from holdings)
                      </span>
                    ) : (
                      <form action={updateAccountBalance} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={a.id} />
                        <input
                          type="number"
                          step="0.01"
                          name="balance"
                          defaultValue={a.balance ?? 0}
                          className="w-32 rounded-md border border-line bg-panel2 px-2 py-1 text-right text-sm text-text outline-none focus:border-gold"
                        />
                        <button type="submit" className="text-sm text-sage hover:underline">
                          Save
                        </button>
                      </form>
                    )}
                    <form action={deleteAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="text-sm text-faint hover:text-warn">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>

                {accountHoldings.length > 0 && (
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-faint">
                        <th className="pb-1 font-normal">Symbol</th>
                        <th className="pb-1 font-normal">Qty</th>
                        <th className="pb-1 font-normal">Cost basis</th>
                        <th className="pb-1 font-normal">Price</th>
                        <th className="pb-1 font-normal">Value</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {accountHoldings.map((h) => (
                        <tr key={h.id} className="border-t border-line">
                          <td className="py-1.5 text-text">{h.symbol}</td>
                          <td className="py-1.5 text-dim">{h.qty}</td>
                          <td className="py-1.5 text-dim">{money(h.cost_basis)}</td>
                          <td className="py-1.5">
                            <form action={updateHoldingPrice} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={h.id} />
                              <input
                                type="number"
                                step="0.0001"
                                name="current_price"
                                defaultValue={h.current_price}
                                className="w-24 rounded-md border border-line bg-panel2 px-2 py-0.5 text-right text-text outline-none focus:border-gold"
                              />
                              <button type="submit" className="text-xs text-sage hover:underline">
                                Save
                              </button>
                            </form>
                          </td>
                          <td className="py-1.5 text-text">{money(h.qty * h.current_price)}</td>
                          <td className="py-1.5 text-right">
                            <form action={deleteHolding}>
                              <input type="hidden" name="id" value={h.id} />
                              <button type="submit" className="text-xs text-faint hover:text-warn">
                                Remove
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        <details className="mt-4 rounded-lg border border-line bg-panel p-4">
          <summary className="cursor-pointer text-sm text-dim">Add account</summary>
          <form action={createAccount} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-faint">
              Name
              <input
                name="name"
                required
                className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Type
              <select
                name="type"
                className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              Starting balance
              <input
                type="number"
                step="0.01"
                name="balance"
                defaultValue={0}
                className="w-32 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-faint">
              System key
              <input
                name="system_key"
                placeholder="hsa, t401k…"
                className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
              />
            </label>
            <label className="flex items-center gap-1 pb-2 text-xs text-faint">
              <input type="checkbox" name="is_system" />
              fed by paycheck contributions
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

      {investmentAccounts.length > 0 && (
        <section>
          <details className="rounded-lg border border-line bg-panel p-4">
            <summary className="cursor-pointer text-sm text-dim">Add holding</summary>
            <form action={createHolding} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-faint">
                Account
                <select
                  name="account_id"
                  className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                >
                  {investmentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Symbol
                <input
                  name="symbol"
                  required
                  className="w-24 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Qty
                <input
                  type="number"
                  step="0.0001"
                  name="qty"
                  defaultValue={0}
                  className="w-24 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Cost basis / share
                <input
                  type="number"
                  step="0.0001"
                  name="cost_basis"
                  defaultValue={0}
                  className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Current price
                <input
                  type="number"
                  step="0.0001"
                  name="current_price"
                  defaultValue={0}
                  className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Buy date
                <input
                  type="date"
                  name="buy_date"
                  className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
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
      )}
    </div>
  );
}
