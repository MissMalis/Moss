import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, listHoldingsForAccount, listLiabilityLoans } from "@/lib/data/accounts";
import { listSnapshotsForAccount } from "@/lib/data/net-worth-snapshots";
import { listDeductions, listIncomeSources } from "@/lib/data/income";
import { accountTypeLabel, blendedApr, defaultAccountIcon } from "@/lib/net-worth";
import { LIABILITY_TYPE_SET } from "@/lib/account-types";
import { getAssetFieldConfig, assetShowsHoldingsList } from "@/lib/account-field-config";
import { deleteAccount } from "@/lib/actions/accounts";
import { getCardForAccount, listCardMultipliers } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/recurring";
import { createCard, updateCard, deleteCard, createMultiplier, deleteMultiplier } from "@/lib/actions/cards";
import { formatMoney } from "@/lib/format";
import { Money } from "@/components/Money";
import { NetWorthLines } from "@/components/NetWorthLines";
import { AddButton } from "@/components/AddButton";
import { IconPicker } from "@/components/IconPicker";
import { IconCircle } from "@/components/IconCircle";
import { HoldingsSection } from "@/components/HoldingsSection";
import { AccountDetailsSection } from "@/components/AccountDetailsSection";
import { AccountContributionSection } from "@/components/AccountContributionSection";
import { LiabilityDetailsSection } from "@/components/LiabilityDetailsSection";
import { LiabilityLoansSection } from "@/components/LiabilityLoansSection";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { RowMenu } from "@/components/RowMenu";
import { Tooltip } from "@/components/Tooltip";
import { Dropdown } from "@/components/Dropdown";
import { CONTRIBUTION_TYPES } from "@/lib/account-types";
import { BTN_GHOST, CARD, CARD_HEADER, INPUT, LABEL, LINK_QUIET } from "@/lib/ui";

const NETWORK_OPTIONS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "Amex" },
  { value: "discover", label: "Discover" },
];

function mask(last4: string | null): string | null {
  return last4 ? `x${last4}` : null;
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const isLiability = LIABILITY_TYPE_SET.has(account.type);
  const isCreditCard = account.type === "Credit card";

  const [holdings, snapshotRows, loans, linkedCard, categories, deductions, incomeSources] = await Promise.all([
    isLiability ? Promise.resolve([]) : listHoldingsForAccount(id),
    listSnapshotsForAccount(id),
    isLiability ? listLiabilityLoans(id) : Promise.resolve([]),
    isCreditCard ? getCardForAccount(id) : Promise.resolve(null),
    isCreditCard ? listCategories() : Promise.resolve([]),
    listDeductions(),
    listIncomeSources(),
  ]);
  const cardMultipliers = linkedCard ? (await listCardMultipliers()).filter((m) => m.card_id === linkedCard.id) : [];
  const accountDeductions = deductions.filter((d) => d.target_account_key === account.system_key);

  const holdingsValue = holdings.reduce((s, h) => s + h.qty * h.current_price, 0);
  const loansTotal = loans.reduce((s, l) => s + l.balance, 0);
  const value = isLiability ? -Math.abs(loans.length > 0 ? loansTotal : account.balance) : account.balance + holdingsValue;
  const blended = isLiability ? blendedApr(loans) : null;
  const series = snapshotRows.map((s) => ({ date: s.snapshot_date, contributed: s.contributed, marketValue: s.market_value }));
  const latest = series[series.length - 1];
  const growth = latest ? latest.marketValue - latest.contributed : 0;

  const assetCfg = !isLiability ? getAssetFieldConfig(account.type) : null;
  const showsHoldings = assetCfg ? assetShowsHoldingsList(assetCfg, account.uses_holdings) : false;

  return (
    <div className="space-y-6">
      <Link href="/net-worth" className={LINK_QUIET}>
        ← Net worth
      </Link>

      <section className={CARD}>
        <div className="flex items-center gap-3">
          <IconCircle value={account.icon ?? defaultAccountIcon(account.type)} label={account.name} variant="solid" />
          <div>
            <h1 className="font-display text-[22px] font-medium text-ink">{account.name}</h1>
            <p className="text-[13px] text-ink-3">
              {accountTypeLabel(account.type)}
              {mask(account.last4) ? ` · ${mask(account.last4)}` : ""}
              {mask(account.debit_card_last4) ? ` · card ${mask(account.debit_card_last4)}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Money value={value} size="section" />
          {account.type === "HYSA" && account.apy_pct ? (
            <p className="mt-1 text-[13px] text-ink-2">
              {account.apy_pct}% APY · ~{formatMoney((account.balance ?? 0) * (account.apy_pct / 100))}/yr earned
            </p>
          ) : isLiability && blended != null ? (
            <p className="mt-1 text-[13px] text-ink-2">{blended}% blended APR</p>
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

      {isLiability ? <LiabilityDetailsSection account={account} /> : <AccountDetailsSection account={account} />}

      {!isLiability && CONTRIBUTION_TYPES.has(account.type) && (
        <AccountContributionSection
          accountSystemKey={account.system_key ?? ""}
          accountType={account.type}
          deductions={accountDeductions}
          incomeSources={incomeSources.map((s) => ({ id: s.id, name: s.name }))}
        />
      )}

      {isLiability && <LiabilityLoansSection accountId={account.id} loans={loans} />}

      {isCreditCard && (
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
                    <Dropdown name="network" options={NETWORK_OPTIONS} defaultValue="visa" />
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
                      {linkedCard.last4 ? ` ${mask(linkedCard.last4)}` : ""} · base {linkedCard.base_multiplier}x
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
                          <Dropdown name="network" options={NETWORK_OPTIONS} defaultValue={linkedCard.network ?? "visa"} />
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
                    <Dropdown name="category_id" options={categories.map((cat) => ({ value: cat.id, label: cat.name }))} defaultValue={categories[0]?.id} />
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

      {showsHoldings && <HoldingsSection accountId={account.id} holdings={holdings} />}

      <div className="flex justify-end">
        <ConfirmDeleteButton action={deleteAccount} hiddenFields={{ id: account.id }} itemLabel={account.name} label="Remove account" />
      </div>
    </div>
  );
}
