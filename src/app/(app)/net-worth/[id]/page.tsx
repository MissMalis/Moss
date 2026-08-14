import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, listHoldingsForAccount, ACCOUNT_TYPES } from "@/lib/data/accounts";
import { listSnapshotsForAccount } from "@/lib/data/net-worth-snapshots";
import { accountEmoji } from "@/lib/net-worth";
import {
  updateAccount,
  deleteAccount,
  updateAccountBalance,
  updateStartingContributed,
} from "@/lib/actions/accounts";
import { createHolding, updateHolding, deleteHolding } from "@/lib/actions/holdings";
import { formatMoney } from "@/lib/format";
import { Money } from "@/components/Money";
import { NetWorthLines } from "@/components/NetWorthLines";
import { AddButton } from "@/components/AddButton";
import { EmojiPicker } from "@/components/EmojiPicker";
import { EmptyState } from "@/components/EmptyState";
import { BTN_GHOST, CARD, INPUT, LABEL, LINK_QUIET } from "@/lib/ui";

const NO_MARKET_TYPES = new Set(["Cash", "Liabilities", "Stored-value"]);

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [holdings, snapshotRows] = await Promise.all([
    listHoldingsForAccount(id),
    listSnapshotsForAccount(id),
  ]);

  const holdingsValue = holdings.reduce((s, h) => s + h.qty * h.current_price, 0);
  const value = account.type === "Liabilities" ? -Math.abs(account.balance) : account.balance + holdingsValue;
  const series = snapshotRows.map((s) => ({ date: s.snapshot_date, contributed: s.contributed, marketValue: s.market_value }));
  const latest = series[series.length - 1];
  const growth = latest ? latest.marketValue - latest.contributed : 0;
  const hasHoldings = holdings.length > 0;

  return (
    <div className="space-y-8">
      <Link href="/net-worth" className={LINK_QUIET}>
        ← Net worth
      </Link>

      <section>
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {account.icon || accountEmoji(account.type)}
          </span>
          <div>
            <h1 className="font-display text-[24px] font-medium text-ink">{account.name}</h1>
            <p className="text-[13px] text-ink-3">{account.type}</p>
          </div>
        </div>
        <div className="mt-3">
          <Money value={value} size="section" />
          {account.type === "HYSA" && account.apy_pct ? (
            <p className="mt-1 text-[13px] text-ink-2">
              {account.apy_pct}% APY · ~{formatMoney((account.balance ?? 0) * (account.apy_pct / 100))}/yr earned
            </p>
          ) : account.type === "Liabilities" && account.apr_pct ? (
            <p className="mt-1 text-[13px] text-ink-2">{account.apr_pct}% APR</p>
          ) : latest ? (
            <p className={`mt-1 text-[13px] ${growth >= 0 ? "text-good" : "text-bad"}`}>
              {growth >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(growth))} growth vs. {formatMoney(latest.contributed)} contributed
            </p>
          ) : null}
        </div>
      </section>

      {series.length > 1 && (
        <section>
          <h2 className="mb-3 font-display text-[18px] font-medium text-ink">Balance over time</h2>
          <NetWorthLines points={series} variant="full" />
        </section>
      )}

      <section className={`flex flex-wrap items-end gap-3 ${CARD}`}>
        <form action={updateAccountBalance} className="flex items-end gap-2">
          <input type="hidden" name="id" value={account.id} />
          <label className={LABEL}>
            {hasHoldings ? "Cash sleeve" : "Balance"}
            <input type="number" step="0.01" name="balance" defaultValue={account.balance ?? 0} className={`w-32 ${INPUT}`} />
          </label>
          <button type="submit" className={BTN_GHOST}>
            Save
          </button>
        </form>

        {(hasHoldings || account.is_system) && (
          <form action={updateStartingContributed} className="flex items-end gap-2">
            <input type="hidden" name="id" value={account.id} />
            <label className={LABEL}>
              Starting contributed
              <input
                type="number"
                step="0.01"
                name="starting_contributed"
                defaultValue={account.starting_contributed ?? 0}
                className={`w-32 ${INPUT}`}
              />
            </label>
            <button type="submit" className={BTN_GHOST}>
              Save
            </button>
          </form>
        )}

        {account.annual_contribution_limit && latest && (
          <p className="text-[12px] text-ink-3">
            {formatMoney(Math.max(0, account.annual_contribution_limit - latest.contributed))} from your{" "}
            {formatMoney(account.annual_contribution_limit)} limit
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[18px] font-medium text-ink">Details</h2>
        <form action={updateAccount} className={`flex flex-wrap items-end gap-3 ${CARD}`}>
          <input type="hidden" name="id" value={account.id} />
          <label className={LABEL}>
            Icon
            <EmojiPicker name="icon" defaultValue={account.icon} />
          </label>
          <label className={LABEL}>
            Name
            <input name="name" defaultValue={account.name} className={INPUT} />
          </label>
          <label className={LABEL}>
            Type
            <select name="type" defaultValue={account.type} className={INPUT}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            APY %
            <input type="number" step="0.01" name="apy_pct" defaultValue={account.apy_pct ?? ""} className={`w-16 ${INPUT}`} />
          </label>
          <label className={LABEL}>
            APR %
            <input type="number" step="0.01" name="apr_pct" defaultValue={account.apr_pct ?? ""} className={`w-16 ${INPUT}`} />
          </label>
          <label className={LABEL}>
            Min cash
            <input type="number" step="0.01" name="min_cash" defaultValue={account.min_cash ?? ""} className={`w-20 ${INPUT}`} />
          </label>
          <label className={LABEL}>
            Annual limit
            <input
              type="number"
              step="0.01"
              name="annual_contribution_limit"
              defaultValue={account.annual_contribution_limit ?? ""}
              className={`w-24 ${INPUT}`}
            />
          </label>
          <button type="submit" className={BTN_GHOST}>
            Save
          </button>
        </form>
      </section>

      {!NO_MARKET_TYPES.has(account.type) && (
        <section>
          <h2 className="mb-3 font-display text-[18px] font-medium text-ink">Holdings</h2>
          {holdings.length === 0 ? (
            <EmptyState emoji="📈" title="No positions yet" hint="Add one below." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                    <th className="pb-1.5 font-normal">Symbol</th>
                    <th className="pb-1.5 font-normal">Shares</th>
                    <th className="pb-1.5 font-normal">Cost basis</th>
                    <th className="pb-1.5 font-normal">Date</th>
                    <th className="pb-1.5 font-normal">Price</th>
                    <th className="pb-1.5 font-normal">Value</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.id} className="border-t border-border">
                      <td colSpan={6} className="py-2">
                        <form action={updateHolding} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={h.id} />
                          <input name="symbol" defaultValue={h.symbol} className={`w-16 py-1 text-[12.5px] ${INPUT}`} />
                          <input
                            type="number"
                            step="0.0001"
                            name="qty"
                            defaultValue={h.qty}
                            className={`w-16 py-1 text-right text-[12.5px] ${INPUT}`}
                          />
                          <input
                            type="number"
                            step="0.0001"
                            name="cost_basis"
                            defaultValue={h.cost_basis}
                            className={`w-20 py-1 text-right text-[12.5px] ${INPUT}`}
                          />
                          <input type="date" name="buy_date" defaultValue={h.buy_date ?? ""} className={`py-1 text-[12.5px] ${INPUT}`} />
                          <input
                            type="number"
                            step="0.0001"
                            name="current_price"
                            defaultValue={h.current_price}
                            className={`w-20 py-1 text-right text-[12.5px] ${INPUT}`}
                          />
                          <span className="text-ink tabular-nums">{formatMoney(h.qty * h.current_price)}</span>
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
          )}

          <div className="mt-4">
            <AddButton label="Add position">
              <form action={createHolding} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="account_id" value={account.id} />
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
                  <input type="number" step="0.0001" name="cost_basis" defaultValue={0} className={`w-28 ${INPUT}`} />
                </label>
                <label className={LABEL}>
                  Current price
                  <input type="number" step="0.0001" name="current_price" defaultValue={0} className={`w-28 ${INPUT}`} />
                </label>
                <label className={LABEL}>
                  Purchase date
                  <input type="date" name="buy_date" className={INPUT} />
                </label>
                <button type="submit" className={BTN_GHOST}>
                  Add position
                </button>
              </form>
            </AddButton>
          </div>
        </section>
      )}

      <form action={deleteAccount}>
        <input type="hidden" name="id" value={account.id} />
        <button type="submit" className={LINK_QUIET}>
          Remove account
        </button>
      </form>
    </div>
  );
}
