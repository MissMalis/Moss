import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, listHoldingsForAccount, ACCOUNT_TYPES } from "@/lib/data/accounts";
import { listSnapshotsForAccount } from "@/lib/data/net-worth-snapshots";
import { accountEmoji, accountTypeLabel, accountGroup, HOLDINGS_TYPES } from "@/lib/net-worth";
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
import { IconGlyph } from "@/components/IconGlyph";
import { EmptyState } from "@/components/EmptyState";
import { BTN_GHOST, CARD, CARD_HEADER, INPUT, LABEL, LINK_QUIET } from "@/lib/ui";

// Holdings grid columns, shared between the header row and every data row
// so figures actually line up (rev 04 §5 — this was misaligned before).
const HOLDINGS_GRID = "grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] items-center gap-2";

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
  const group = accountGroup(account.type);
  // Rev 04 §5: cash sleeve only for HSA; the holdings-only types (401(k),
  // IRAs, brokerage) no longer show a balance field at all.
  const showsBalance = !HOLDINGS_TYPES.has(account.type);
  const showsHoldings = HOLDINGS_TYPES.has(account.type);

  return (
    <div className="space-y-6">
      <Link href="/net-worth" className={LINK_QUIET}>
        ← Net worth
      </Link>

      <section className={CARD}>
        <div className="flex items-center gap-3">
          <IconGlyph value={account.icon} fallback={accountEmoji(account.type)} className="text-[24px]" />
          <div>
            <h1 className="font-display text-[22px] font-medium text-ink">{account.name}</h1>
            <p className="text-[13px] text-ink-3">{accountTypeLabel(account.type)}</p>
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

        {series.length > 1 && (
          <div className="mt-4">
            <NetWorthLines points={series} variant="full" />
          </div>
        )}
      </section>

      <section className={`flex flex-wrap items-end gap-3 ${CARD}`}>
        {showsBalance && (
          <form action={updateAccountBalance} className="flex items-end gap-2">
            <input type="hidden" name="id" value={account.id} />
            <label className={LABEL}>
              {account.type === "HSA" ? "Cash" : "Balance"}
              <input type="number" step="0.01" name="balance" defaultValue={account.balance ?? 0} className={`w-32 ${INPUT}`} />
            </label>
            <button type="submit" className={BTN_GHOST}>
              Save
            </button>
          </form>
        )}

        {group === "Investments" && (
          <form action={updateStartingContributed} className="flex items-end gap-2">
            <input type="hidden" name="id" value={account.id} />
            <label className={LABEL}>
              Total contributions
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

      <section className={CARD}>
        <p className={CARD_HEADER}>Details</p>
        <form action={updateAccount} className="mt-3 flex flex-wrap items-end gap-3">
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
                  {accountTypeLabel(t)}
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

      {showsHoldings && (
        <section className={CARD}>
          <p className={CARD_HEADER}>Holdings</p>
          {holdings.length === 0 ? (
            <div className="mt-3">
              <EmptyState emoji="📈" title="No positions yet" hint="Add one below." />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <div className={`${HOLDINGS_GRID} pb-1.5 text-[11px] uppercase tracking-wide text-ink-3`}>
                <span>Symbol</span>
                <span>Shares</span>
                <span>Cost basis</span>
                <span>Date</span>
                <span>Price</span>
                <span>Value</span>
                <span />
              </div>
              <div className="space-y-1.5">
                {holdings.map((h) => {
                  const formId = `holding-${h.id}`;
                  return (
                    <div key={h.id} className={`${HOLDINGS_GRID} rounded-lg border border-border bg-card-soft px-2 py-1.5 text-[12.5px]`}>
                      {/* An empty, display:none <form> whose action every input below associates with via the form="" attribute — keeps the grid columns real siblings instead of nested inside a <form>, which is what caused the old misalignment, without the form itself eating a grid cell. */}
                      <form id={formId} action={updateHolding} className="hidden">
                        <input type="hidden" name="id" value={h.id} />
                      </form>
                      <input form={formId} name="symbol" defaultValue={h.symbol} className={`w-full py-1 text-[12.5px] ${INPUT}`} />
                      <input form={formId} type="number" step="0.0001" name="qty" defaultValue={h.qty} className={`w-full py-1 text-right text-[12.5px] ${INPUT}`} />
                      <input
                        form={formId}
                        type="number"
                        step="0.0001"
                        name="cost_basis"
                        defaultValue={h.cost_basis}
                        className={`w-full py-1 text-right text-[12.5px] ${INPUT}`}
                      />
                      <input form={formId} type="date" name="buy_date" defaultValue={h.buy_date ?? ""} className={`w-full py-1 text-[12.5px] ${INPUT}`} />
                      <input
                        form={formId}
                        type="number"
                        step="0.0001"
                        name="current_price"
                        defaultValue={h.current_price}
                        className={`w-full py-1 text-right text-[12.5px] ${INPUT}`}
                      />
                      <span className="text-ink tabular-nums">{formatMoney(h.qty * h.current_price)}</span>
                      <span className="flex items-center gap-2 justify-self-end">
                        <button form={formId} type="submit" className={LINK_QUIET}>
                          Save
                        </button>
                        <form action={deleteHolding}>
                          <input type="hidden" name="id" value={h.id} />
                          <button type="submit" className={LINK_QUIET}>
                            Remove
                          </button>
                        </form>
                      </span>
                    </div>
                  );
                })}
              </div>
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
