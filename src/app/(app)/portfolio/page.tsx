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
import { listCards, listCardMultipliers } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/recurring";
import { getSettings } from "@/lib/data/settings";
import { createCard, deleteCard, createMultiplier, deleteMultiplier, setCashAppCard } from "@/lib/actions/cards";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { MockCard } from "@/components/MockCard";
import { NetWorthLines } from "@/components/NetWorthLines";
import { EmptyState } from "@/components/EmptyState";
import { RefreshPricesButton } from "@/components/RefreshPricesButton";
import { Tooltip } from "@/components/Tooltip";
import { BTN_DASHED, BTN_GHOST, BTN_SOLID, INPUT, LABEL, LINK_QUIET, ROW } from "@/lib/ui";

const NO_MARKET_TYPES = new Set(["Cash", "Liabilities", "Stored-value"]);

export default async function PortfolioPage() {
  const [accounts, holdings] = await Promise.all([listAccounts(), listHoldings()]);
  await ensureSnapshotsForToday({ accounts, holdings });
  const [snapshots, cards, multipliers, categories, settings] = await Promise.all([
    listAllSnapshots(),
    listCards(),
    listCardMultipliers(),
    listCategories(),
    getSettings(),
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
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const channelingCard = cards.find((c) => c.id === settings.cash_app_card_id) ?? null;

  return (
    <div className="space-y-8">
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-medium text-ink">Accounts</h2>
          <RefreshPricesButton symbols={Array.from(new Set(holdings.map((h) => h.symbol)))} />
        </div>

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
                        {a.type === "HYSA" && a.apy_pct ? (
                          <p className="text-[11.5px] text-ink-3">
                            {a.apy_pct}% APY · ~{formatMoney((a.balance ?? 0) * (a.apy_pct / 100))}/yr
                          </p>
                        ) : NO_MARKET_TYPES.has(a.type) ? (
                          <p className="text-[11.5px] text-ink-3">no market movement</p>
                        ) : latest ? (
                          <p className={`text-[11.5px] ${growth >= 0 ? "text-good" : "text-bad"}`}>
                            {growth >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(growth))} growth
                          </p>
                        ) : null}
                      </div>

                      {trackable && series.length > 1 && <NetWorthLines points={series} variant="spark" />}

                      <div className="flex flex-col items-end gap-1">
                        <form action={updateAccountBalance} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={a.id} />
                          <span className="text-[11px] text-ink-3">{valuedByHoldings ? "Cash" : "Balance"}</span>
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
                        <form action={deleteAccount}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className={LINK_QUIET}>
                            Remove
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>

                  {a.annual_contribution_limit && latest && (
                    <p className="mt-2 text-[12px] text-ink-3">
                      {formatMoney(Math.max(0, a.annual_contribution_limit - latest.contributed))} from
                      your {formatMoney(a.annual_contribution_limit)} limit
                    </p>
                  )}

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

        <details className="mt-4 rounded-xl border border-border bg-card p-5">
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
              <span className="flex items-center gap-1">
                APY %
                <Tooltip text="For a high-yield savings account — used to show accrued interest. Leave blank for anything else." />
              </span>
              <input type="number" step="0.01" name="apy_pct" className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              <span className="flex items-center gap-1">
                Annual limit
                <Tooltip text="Optional — for 401k/HSA/IRA accounts, Moss will show how close you are to it as the year goes." />
              </span>
              <input type="number" step="0.01" name="annual_contribution_limit" className={`w-28 ${INPUT}`} />
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
          <details className="rounded-xl border border-dashed border-border-strong bg-card-soft p-5">
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

      <section className="flex flex-wrap items-start gap-6">
        {channelingCard ? (
          <MockCard
            name={channelingCard.name}
            last4={channelingCard.last4}
            network={channelingCard.network}
            color={channelingCard.color}
          />
        ) : (
          <div className="flex h-[150px] w-[240px] items-center justify-center rounded-lg border border-dashed border-border-strong text-[12.5px] text-ink-3">
            No channeling card set
          </div>
        )}
        <div className="flex-1 min-w-[220px]">
          <p className="text-[13px] text-ink-2">
            Which card channels rewards charges into your buffer?
            <Tooltip text="Just for the visual above and for Sweep — pick whichever card you use for quarantined rewards spending." />
          </p>
          <form action={setCashAppCard} className="mt-2 flex items-center gap-2">
            <select
              name="cash_app_card_id"
              defaultValue={settings.cash_app_card_id ?? ""}
              className={INPUT}
            >
              <option value="">None</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className={BTN_GHOST}>
              Save
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Cards</h2>
        {cards.length === 0 ? (
          <EmptyState emoji="💳" title="No cards yet" hint="Add your first one below." />
        ) : (
          <div className="space-y-2">
            {cards.map((c) => {
              const cardMultipliers = multipliers.filter((m) => m.card_id === c.id);
              return (
                <div key={c.id} className={ROW}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] text-ink">{c.name}</p>
                      <p className="text-[12px] text-ink-3">
                        {c.network ?? "card"} · base {c.base_multiplier}x
                      </p>
                    </div>
                    <form action={deleteCard}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className={LINK_QUIET}>
                        Remove
                      </button>
                    </form>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                      {cardMultipliers.length} category bonus{cardMultipliers.length === 1 ? "" : "es"}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {cardMultipliers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-ink-2">
                            {categoryById.get(m.category_id)?.emoji}{" "}
                            {categoryById.get(m.category_id)?.name ?? "—"}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-ink">{m.multiplier}x</span>
                            <form action={deleteMultiplier}>
                              <input type="hidden" name="id" value={m.id} />
                              <button type="submit" className={LINK_QUIET}>
                                Remove
                              </button>
                            </form>
                          </span>
                        </div>
                      ))}
                    </div>
                    {categories.length === 0 ? (
                      <p className="mt-2 text-[12px] text-ink-3">
                        Add a category in Expenses first, then come back to set a bonus.
                      </p>
                    ) : (
                      <form action={createMultiplier} className="mt-2 flex items-end gap-2">
                        <input type="hidden" name="card_id" value={c.id} />
                        <select name="category_id" required className={`py-1 text-[12.5px] ${INPUT}`}>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.emoji} {cat.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.5"
                          name="multiplier"
                          defaultValue={2}
                          required
                          className={`w-16 py-1 text-[12.5px] ${INPUT}`}
                        />
                        <button type="submit" className={LINK_QUIET}>
                          Add bonus
                        </button>
                      </form>
                    )}
                  </details>
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4 rounded-xl border border-border bg-card p-5">
          <summary className="cursor-pointer text-[13px] text-ink-2">Add a card</summary>
          <form action={createCard} className="mt-3 flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Name
              <input name="name" required placeholder="Chase Sapphire" className={INPUT} />
            </label>
            <label className={LABEL}>
              Last 4
              <input name="last4" maxLength={4} className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Network
              <select name="network" className={INPUT}>
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="amex">Amex</option>
                <option value="discover">Discover</option>
              </select>
            </label>
            <label className={LABEL}>
              Base multiplier
              <input type="number" step="0.5" name="base_multiplier" defaultValue={1} className={`w-20 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Card color
              <input type="color" name="color" defaultValue="#14181C" className="h-9 w-14 rounded-lg border border-border" />
            </label>
            <button type="submit" className={BTN_SOLID}>
              Add card
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
