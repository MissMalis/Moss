import { listAccounts, listHoldings, ACCOUNT_TYPES } from "@/lib/data/accounts";
import { ensureSnapshotsForToday, listAllSnapshots } from "@/lib/data/net-worth-snapshots";
import { computeNetWorth, accountEmoji, type HistoryPoint } from "@/lib/net-worth";
import {
  createAccount,
  deleteAccount,
  updateAccountBalance,
  updateStartingContributed,
} from "@/lib/actions/accounts";
import { createHolding, deleteHolding, updateHoldingPrice } from "@/lib/actions/holdings";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { NetWorthLines } from "@/components/NetWorthLines";
import { EmptyState } from "@/components/EmptyState";
import { BTN_DASHED, BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

const NO_MARKET_TYPES = new Set(["Cash", "Liabilities"]);

export default async function NetWorthPage() {
  await ensureSnapshotsForToday();

  const [accounts, holdings, snapshots] = await Promise.all([
    listAccounts(),
    listHoldings(),
    listAllSnapshots(),
  ]);

  const netWorth = computeNetWorth(accounts, holdings);

  const holdingsByAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    if (!h.account_id) continue;
    holdingsByAccount.set(h.account_id, [...(holdingsByAccount.get(h.account_id) ?? []), h]);
  }

  const snapshotsByAccount = new Map<string, HistoryPoint[]>();
  for (const s of snapshots) {
    const list = snapshotsByAccount.get(s.account_id) ?? [];
    list.push({ date: s.snapshot_date, contributed: s.contributed, marketValue: s.market_value });
    snapshotsByAccount.set(s.account_id, list);
  }

  let totalContributed = 0;
  let totalMarket = 0;
  for (const [, series] of snapshotsByAccount) {
    const latest = series[series.length - 1];
    if (!latest) continue;
    totalContributed += latest.contributed;
    totalMarket += latest.marketValue;
  }
  const totalGrowth = totalMarket - totalContributed;

  const investmentAccounts = accounts.filter((a) =>
    ["Roth IRA", "Traditional IRA", "Taxable Brokerage", "HSA"].includes(a.type),
  );

  return (
    <div className="space-y-10">
      <section>
        <p className="text-[12.5px] uppercase tracking-wide text-ink-3">Net worth</p>
        <Money value={netWorth.total} size="section" />
        {totalContributed > 0 && (
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            <span className={totalGrowth >= 0 ? "text-good" : "text-bad"}>
              {totalGrowth >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(totalGrowth))} growth
            </span>{" "}
            · you added {formatMoney(totalContributed)} total
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px] text-ink-2">
          {ACCOUNT_TYPES.map((t) =>
            netWorth.byType[t] !== undefined ? (
              <span key={t} className="rounded-full border border-border px-3 py-1">
                {t}: <span className="text-ink">{formatMoney(netWorth.byType[t])}</span>
              </span>
            ) : null,
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Accounts</h2>

        {accounts.length === 0 ? (
          <EmptyState emoji="🏦" title="No accounts yet" hint="Add your first one below." />
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => {
              const accountHoldings = holdingsByAccount.get(a.id) ?? [];
              const valuedByHoldings = accountHoldings.length > 0;
              const trackable = valuedByHoldings || a.is_system;
              const series = snapshotsByAccount.get(a.id) ?? [];
              const latest = series[series.length - 1];
              const growth = latest ? latest.marketValue - latest.contributed : 0;
              const value = netWorth.accounts.find((av) => av.id === a.id)?.value ?? a.balance;

              return (
                <div key={a.id} className={ROW}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl" aria-hidden>
                        {accountEmoji(a.type)}
                      </span>
                      <div>
                        <p className="text-[14px] text-ink">{a.name}</p>
                        <p className="text-[12px] text-ink-3">{a.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Money value={value} size="card" />
                        {NO_MARKET_TYPES.has(a.type) ? (
                          <p className="text-[11.5px] text-ink-3">no market movement</p>
                        ) : latest ? (
                          <p className={`text-[11.5px] ${growth >= 0 ? "text-good" : "text-bad"}`}>
                            {growth >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(growth))} growth
                          </p>
                        ) : null}
                      </div>

                      {trackable && series.length > 1 && <NetWorthLines points={series} variant="spark" />}

                      <div className="flex flex-col items-end gap-1">
                        {!valuedByHoldings && (
                          <form action={updateAccountBalance} className="flex items-center gap-1.5">
                            <input type="hidden" name="id" value={a.id} />
                            <input
                              type="number"
                              step="0.01"
                              name="balance"
                              defaultValue={a.balance ?? 0}
                              className={`w-24 py-1 text-right text-[12.5px] ${INPUT}`}
                            />
                            <button type="submit" className={LINK_QUIET}>
                              Save
                            </button>
                          </form>
                        )}
                        <form action={deleteAccount}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className={LINK_QUIET}>
                            Remove
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {trackable && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                        Starting contributed: {formatMoney(a.starting_contributed ?? 0)}
                      </summary>
                      <form action={updateStartingContributed} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="id" value={a.id} />
                        <p className="text-[12px] text-ink-3">
                          What you&apos;d already contributed before Moss started tracking
                        </p>
                        <input
                          type="number"
                          step="0.01"
                          name="starting_contributed"
                          defaultValue={a.starting_contributed ?? 0}
                          className={`w-28 py-1 text-right text-[12.5px] ${INPUT}`}
                        />
                        <button type="submit" className={LINK_QUIET}>
                          Save
                        </button>
                      </form>
                    </details>
                  )}

                  {valuedByHoldings && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                        {accountHoldings.length} position{accountHoldings.length === 1 ? "" : "s"}
                      </summary>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                              <th className="pb-1.5 font-normal">Symbol</th>
                              <th className="pb-1.5 font-normal">Shares</th>
                              <th className="pb-1.5 font-normal">Cost basis</th>
                              <th className="pb-1.5 font-normal">Date</th>
                              <th className="pb-1.5 font-normal">Value</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {accountHoldings.map((h) => (
                              <tr key={h.id} className="border-t border-border">
                                <td className="py-2 text-ink">{h.symbol}</td>
                                <td className="py-2 text-ink-2 tabular-nums">{h.qty}</td>
                                <td className="py-2 text-ink-2 tabular-nums">
                                  {formatMoney(h.cost_basis)}
                                </td>
                                <td className="py-2 text-ink-2">
                                  {h.buy_date ? formatShortDateLabel(h.buy_date) : "—"}
                                </td>
                                <td className="py-2">
                                  <form action={updateHoldingPrice} className="flex items-center gap-1">
                                    <input type="hidden" name="id" value={h.id} />
                                    <input
                                      type="number"
                                      step="0.0001"
                                      name="current_price"
                                      defaultValue={h.current_price}
                                      className={`w-20 py-1 text-right text-[12.5px] ${INPUT}`}
                                    />
                                    <span className="text-ink tabular-nums">
                                      {formatMoney(h.qty * h.current_price)}
                                    </span>
                                    <button type="submit" className={LINK_QUIET}>
                                      Save
                                    </button>
                                  </form>
                                </td>
                                <td className="py-2 text-right">
                                  <form action={deleteHolding}>
                                    <input type="hidden" name="id" value={h.id} />
                                    <button type="submit" className={LINK_QUIET}>
                                      Remove
                                    </button>
                                  </form>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4 rounded-[20px] border border-border bg-card p-5">
          <summary className="cursor-pointer text-[13px] text-ink-2">Add account</summary>
          <form action={createAccount} className="mt-3 flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Name
              <input name="name" required className={INPUT} />
            </label>
            <label className={LABEL}>
              Type
              <select name="type" className={INPUT}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Starting balance
              <input type="number" step="0.01" name="balance" defaultValue={0} className={`w-32 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Starting contributed
              <input
                type="number"
                step="0.01"
                name="starting_contributed"
                defaultValue={0}
                className={`w-32 ${INPUT}`}
              />
            </label>
            <label className={LABEL}>
              System key
              <input name="system_key" placeholder="hsa, t401k…" className={`w-28 ${INPUT}`} />
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
              <input type="checkbox" name="is_system" />
              Fed by paycheck contributions
            </label>
            <button type="submit" className={BTN_SOLID}>
              Add account
            </button>
          </form>
        </details>
      </section>

      {investmentAccounts.length > 0 && (
        <section>
          <details className="rounded-[20px] border border-dashed border-border-strong bg-card-soft p-5">
            <summary className={`cursor-pointer ${BTN_DASHED} inline-block border-0 p-0 hover:border-0`}>
              + Add position
            </summary>
            <form action={createHolding} className="mt-3 flex flex-wrap items-end gap-3">
              <label className={LABEL}>
                Account
                <select name="account_id" className={INPUT}>
                  {investmentAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL}>
                Symbol
                <input name="symbol" required className={`w-24 ${INPUT}`} />
              </label>
              <label className={LABEL}>
                Shares
                <input type="number" step="0.0001" name="qty" defaultValue={0} className={`w-24 ${INPUT}`} />
              </label>
              <label className={LABEL}>
                Cost basis / share
                <input
                  type="number"
                  step="0.0001"
                  name="cost_basis"
                  defaultValue={0}
                  className={`w-28 ${INPUT}`}
                />
              </label>
              <label className={LABEL}>
                Current price
                <input
                  type="number"
                  step="0.0001"
                  name="current_price"
                  defaultValue={0}
                  className={`w-28 ${INPUT}`}
                />
              </label>
              <label className={LABEL}>
                Purchase date
                <input type="date" name="buy_date" className={INPUT} />
              </label>
              <button type="submit" className={BTN_SOLID}>
                Add position
              </button>
            </form>
          </details>
        </section>
      )}
    </div>
  );
}
