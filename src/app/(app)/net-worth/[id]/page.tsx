import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, listHoldingsForAccount } from "@/lib/data/accounts";
import { listSnapshotsForAccount } from "@/lib/data/net-worth-snapshots";
import { listDeductions } from "@/lib/data/income";
import { listIncomeSources } from "@/lib/data/income";
import { accountTypeLabel, HOLDINGS_TYPES } from "@/lib/net-worth";
import { deleteAccount } from "@/lib/actions/accounts";
import { createHolding, updateHolding, deleteHolding } from "@/lib/actions/holdings";
import { getCardForAccount, listCardMultipliers } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/recurring";
import { createCard, updateCard, deleteCard, createMultiplier, deleteMultiplier } from "@/lib/actions/cards";
import { formatMoney } from "@/lib/format";
import { Money } from "@/components/Money";
import { NetWorthLines } from "@/components/NetWorthLines";
import { AddButton } from "@/components/AddButton";
import { IconPicker } from "@/components/IconPicker";
import { IconCircle } from "@/components/IconCircle";
import { HoldingFields } from "@/components/TickerPriceField";
import { AccountDetailsSection } from "@/components/AccountDetailsSection";
import { AccountContributionSection } from "@/components/AccountContributionSection";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { RowMenu } from "@/components/RowMenu";
import { Tooltip } from "@/components/Tooltip";
import { EmptyState } from "@/components/EmptyState";
import { lucideKey } from "@/lib/icons";
import { BTN_GHOST, CARD, CARD_HEADER, INPUT, LABEL, LINK_QUIET } from "@/lib/ui";

// Holdings grid columns, shared between the header row and every data row
// so figures actually line up (rev 04 §5 — this was misaligned before).
const HOLDINGS_GRID = "grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] items-center gap-2";
const ADD_POSITION_GRID = "grid grid-cols-[1fr_1fr_1fr_1fr_1fr] items-center gap-2";

// Rev 06b §2: HSA now shows both a cash sleeve AND holdings (un-simplified
// from Rev 05); every other investing type toggles between the two via
// `uses_holdings`.
const CONTRIBUTION_TYPES = new Set(["HSA", "401(k)", "Traditional IRA", "Roth IRA"]);

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const isLiability = account.type === "Liabilities";
  const isHSA = account.type === "HSA";
  const [holdings, snapshotRows, linkedCard, categories, deductions, incomeSources] = await Promise.all([
    listHoldingsForAccount(id),
    listSnapshotsForAccount(id),
    isLiability ? getCardForAccount(id) : Promise.resolve(null),
    isLiability ? listCategories() : Promise.resolve([]),
    listDeductions(),
    listIncomeSources(),
  ]);
  const cardMultipliers = linkedCard ? (await listCardMultipliers()).filter((m) => m.card_id === linkedCard.id) : [];
  const accountDeductions = deductions.filter((d) => d.target_account_key === account.system_key);

  const holdingsValue = holdings.reduce((s, h) => s + h.qty * h.current_price, 0);
  const value = account.type === "Liabilities" ? -Math.abs(account.balance) : account.balance + holdingsValue;
  const series = snapshotRows.map((s) => ({ date: s.snapshot_date, contributed: s.contributed, marketValue: s.market_value }));
  const latest = series[series.length - 1];
  const growth = latest ? latest.marketValue - latest.contributed : 0;
  // §2: holdings show for HSA (always, alongside its cash sleeve) or an
  // investing type with the shares toggle on. Cash-sleeve/balance display
  // is handled inside AccountDetailsSection.
  const showsHoldings = isHSA || (HOLDINGS_TYPES.has(account.type) && account.uses_holdings);

  return (
    <div className="space-y-6">
      <Link href="/net-worth" className={LINK_QUIET}>
        ← Net worth
      </Link>

      <section className={CARD}>
        <div className="flex items-center gap-3">
          <IconCircle value={account.icon} label={account.name} variant="solid" />
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

      <AccountDetailsSection account={account} />

      {CONTRIBUTION_TYPES.has(account.type) && (
        <AccountContributionSection
          accountSystemKey={account.system_key ?? ""}
          accountType={account.type}
          deductions={accountDeductions}
          incomeSources={incomeSources.map((s) => ({ id: s.id, name: s.name }))}
        />
      )}

      {isLiability && (
        <section className={CARD}>
          <p className={CARD_HEADER}>Card</p>
          {!linkedCard ? (
            <div className="mt-3">
              <AddButton label="Link a card">
                <form action={createCard} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="account_id" value={account.id} />
                  <label className={LABEL}>
                    Icon
                    <IconPicker name="icon" label={account.name} />
                  </label>
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
                  <button type="submit" className={BTN_GHOST}>
                    Link card
                  </button>
                </form>
              </AddButton>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <IconCircle value={linkedCard.icon} label={linkedCard.name} variant="solid" />
                  <div>
                    <p className="text-[14px] text-ink">{linkedCard.name}</p>
                    <p className="text-[12px] text-ink-3">
                      {linkedCard.network ?? "card"}
                      {linkedCard.last4 ? ` ···· ${linkedCard.last4}` : ""} · base {linkedCard.base_multiplier}x
                    </p>
                  </div>
                </div>
                <RowMenu
                  popovers={[
                    {
                      label: "Edit card",
                      content: (
                        <form action={updateCard} className="flex flex-col gap-2">
                          <input type="hidden" name="id" value={linkedCard.id} />
                          <div className="flex items-end gap-2">
                            <IconPicker name="icon" label={linkedCard.name} defaultValue={linkedCard.icon} />
                            <input name="name" defaultValue={linkedCard.name} className={`min-w-0 flex-1 ${INPUT}`} />
                          </div>
                          <input name="last4" defaultValue={linkedCard.last4 ?? ""} maxLength={4} placeholder="Last 4" className={INPUT} />
                          <select name="network" defaultValue={linkedCard.network ?? "visa"} className={INPUT}>
                            <option value="visa">Visa</option>
                            <option value="mastercard">Mastercard</option>
                            <option value="amex">Amex</option>
                            <option value="discover">Discover</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.5"
                              name="base_multiplier"
                              defaultValue={linkedCard.base_multiplier}
                              className={`min-w-0 flex-1 ${INPUT}`}
                            />
                            <input type="color" name="color" defaultValue={linkedCard.color} className="h-9 w-14 rounded-lg border border-border" />
                          </div>
                          <button type="submit" className={BTN_GHOST}>
                            Save
                          </button>
                        </form>
                      ),
                    },
                  ]}
                >
                  <ConfirmDeleteButton action={deleteCard} hiddenFields={{ id: linkedCard.id }} itemLabel={linkedCard.name} variant="link" />
                </RowMenu>
              </div>

              <details className="mt-3">
                <summary className="flex cursor-pointer items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink-2">
                  {cardMultipliers.length} category bonus{cardMultipliers.length === 1 ? "" : "es"}
                  <Tooltip text="Extra points/cashback this card earns on specific categories, on top of its base multiplier." />
                </summary>
                <div className="mt-2 space-y-1">
                  {cardMultipliers.map((m) => {
                    const cat = categories.find((c) => c.id === m.category_id);
                    return (
                      <div key={m.id} className="flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-1.5 text-ink-2">
                          {cat && <IconCircle value={cat.emoji} label={cat.name} color={cat.color} variant="tinted" size="sm" />}
                          {cat?.name ?? "—"}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-ink">{m.multiplier}x</span>
                          <ConfirmDeleteButton action={deleteMultiplier} hiddenFields={{ id: m.id }} itemLabel={`this bonus`} variant="link" />
                        </span>
                      </div>
                    );
                  })}
                </div>
                {categories.length === 0 ? (
                  <p className="mt-2 text-[12px] text-ink-3">Add a category in Expenses first, then come back to set a bonus.</p>
                ) : (
                  <form action={createMultiplier} className="mt-2 flex items-end gap-2">
                    <input type="hidden" name="card_id" value={linkedCard.id} />
                    <select name="category_id" required className={`py-1 text-[12.5px] ${INPUT}`}>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <input type="number" step="0.5" name="multiplier" defaultValue={2} required className={`w-16 py-1 text-[12.5px] ${INPUT}`} />
                    <button type="submit" className={LINK_QUIET}>
                      Add bonus
                    </button>
                  </form>
                )}
              </details>
            </div>
          )}
        </section>
      )}

      {showsHoldings && (
        <section className={CARD}>
          <p className={CARD_HEADER}>Holdings</p>
          {holdings.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={lucideKey("trending-up")} title="No positions yet" hint="Add one below." />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <div className={`${HOLDINGS_GRID} pb-1.5 text-center text-[11px] uppercase tracking-wide text-ink-3`}>
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
                      <HoldingFields
                        formId={formId}
                        symbolDefault={h.symbol}
                        qtyDefault={h.qty}
                        costBasisDefault={h.cost_basis}
                        buyDateDefault={h.buy_date ?? ""}
                        priceDefault={h.current_price}
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
              <form action={createHolding} className="flex flex-col gap-3">
                <input type="hidden" name="account_id" value={account.id} />
                <div className={`${ADD_POSITION_GRID} pb-1 text-center text-[11px] uppercase tracking-wide text-ink-3`}>
                  <span>Symbol</span>
                  <span>Shares</span>
                  <span>Cost basis</span>
                  <span>Date</span>
                  <span>Price</span>
                </div>
                <div className={ADD_POSITION_GRID}>
                  <HoldingFields />
                </div>
                <button type="submit" className={`${BTN_GHOST} self-start`}>
                  Add position
                </button>
              </form>
            </AddButton>
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <ConfirmDeleteButton action={deleteAccount} hiddenFields={{ id: account.id }} itemLabel={account.name} label="Remove account" />
      </div>
    </div>
  );
}
