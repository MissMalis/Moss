"use client";

import { useState } from "react";
import { updateAccount } from "@/lib/actions/accounts";
import { accountTypeLabel } from "@/lib/net-worth";
import { getAssetFieldConfig, assetShowsBalanceField, assetShowsLumpCostBasis } from "@/lib/account-field-config";
import { formatMoney, formatShortDateLabel, formatLast4 } from "@/lib/format";
import { IconPicker } from "@/components/IconPicker";
import { ActionForm } from "@/components/ActionForm";
import { Employer401kMatchFields } from "@/components/Employer401kMatchFields";
import { Dropdown } from "@/components/Dropdown";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL } from "@/lib/ui";

type AccountRow = {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  institution: string | null;
  balance: number;
  starting_contributed: number;
  apy_pct: number | null;
  min_cash: number | null;
  annual_contribution_limit: number | null;
  last4: string | null;
  debit_card_last4: string | null;
  debit_card_network: string | null;
  uses_holdings: boolean;
  salary: number | null;
  match_tier1_pct: number | null;
  match_tier2_limit_pct: number | null;
  match_tier2_rate_pct: number | null;
  notes: string | null;
  balance_updated_at: string | null;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-[13.5px] last:border-0">
      <span className="text-ink-2">{label}</span>
      <span className="text-ink tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Rev 06b v2 §3/§8: an ASSET's detail/edit — read-only by default with an
 * Edit button. Uses the exact same `getAssetFieldConfig` the wizard uses,
 * so a checking account can never show APY/min-cash/annual-limit here
 * either (the bug this revision fixes).
 */
export function AccountDetailsSection({ account }: { account: AccountRow }) {
  const [editing, setEditing] = useState(false);
  const cfg = getAssetFieldConfig(account.type);
  const [usesHoldings, setUsesHoldings] = useState(account.uses_holdings);
  const [showDebitCard, setShowDebitCard] = useState(!!account.debit_card_last4);
  const showsBalance = assetShowsBalanceField(cfg, usesHoldings);
  const showsLumpCostBasis = assetShowsLumpCostBasis(cfg, usesHoldings);

  if (!editing) {
    return (
      <section className={CARD}>
        <div className="flex items-center justify-between">
          <p className={CARD_HEADER}>Details</p>
          <button type="button" onClick={() => setEditing(true)} className={BTN_GHOST}>
            Edit
          </button>
        </div>
        <div className="mt-2">
          <Row label="Type" value={accountTypeLabel(account.type)} />
          <Row label="Institution" value={account.institution} />
          {showsBalance && (
            <Row
              label={cfg.alwaysBothCashAndHoldings ? "Cash sleeve" : cfg.isHoldingsToggle ? "Total value" : "Balance"}
              value={formatMoney(account.balance ?? 0)}
            />
          )}
          <Row label="As of" value={account.balance_updated_at ? formatShortDateLabel(account.balance_updated_at.slice(0, 10)) : null} />
          {cfg.showsLast4 && <Row label="Account #" value={formatLast4(account.last4)} />}
          {(cfg.showsLinkedCard || cfg.showsDebitCardLast4) && (
            <Row label="Linked card" value={account.debit_card_last4 ? `${account.debit_card_network ?? ""} ${formatLast4(account.debit_card_last4)}`.trim() : null} />
          )}
          {cfg.showsAPY && <Row label="APY" value={account.apy_pct ? `${account.apy_pct}%` : null} />}
          {cfg.showsMinCash && <Row label="Minimum-cash threshold" value={account.min_cash != null ? formatMoney(account.min_cash) : null} />}
          {cfg.showsAnnualLimit && (
            <Row label="Annual limit" value={account.annual_contribution_limit != null ? formatMoney(account.annual_contribution_limit) : null} />
          )}
          {cfg.isHoldingsToggle && <Row label="Tracking" value={usesHoldings ? "Individual shares" : "Lump total"} />}
          {showsLumpCostBasis && <Row label="Cost basis" value={account.starting_contributed ? formatMoney(account.starting_contributed) : null} />}
          {cfg.showsSalaryAndMatch && (
            <>
              <Row label="Salary" value={account.salary != null ? formatMoney(account.salary) + "/yr" : null} />
              {account.match_tier1_pct != null && (
                <Row
                  label="Employer match"
                  value={`100% up to ${account.match_tier1_pct}%, then ${account.match_tier2_rate_pct}% up to ${account.match_tier2_limit_pct}%`}
                />
              )}
            </>
          )}
          {cfg.showsNotes && <Row label="Notes" value={account.notes} />}
        </div>
      </section>
    );
  }

  return (
    <section className={CARD}>
      <p className={CARD_HEADER}>Details</p>
      <ActionForm action={updateAccount} onSuccess={() => setEditing(false)} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={account.id} />
        <input type="hidden" name="type" value={account.type} />
        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL}>
            Icon
            <IconPicker name="icon" label={account.name} defaultValue={account.icon} />
          </label>
          <label className={LABEL}>
            Name
            <input name="name" defaultValue={account.name} className={INPUT} />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL}>
            Institution
            <input name="institution" defaultValue={account.institution ?? ""} placeholder="TD Bank" className={`w-40 ${INPUT}`} />
          </label>
          {showsBalance && !cfg.isHoldingsToggle && (
            <label className={LABEL}>
              {cfg.alwaysBothCashAndHoldings ? "Cash sleeve" : "Balance"}
              <input type="number" step="0.01" name="balance" defaultValue={account.balance ?? 0} className={`w-32 ${INPUT}`} />
            </label>
          )}
          <label className={LABEL}>
            As of
            <input
              type="date"
              name="as_of"
              defaultValue={account.balance_updated_at?.slice(0, 10)}
              style={{ colorScheme: "light" }}
              className={INPUT}
            />
          </label>
          {cfg.showsAPY && (
            <label className={LABEL}>
              APY %
              <input type="number" step="0.01" name="apy_pct" defaultValue={account.apy_pct ?? ""} className={`w-20 ${INPUT}`} />
            </label>
          )}
        </div>

        {cfg.showsLast4 && (
          <div className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Last 4 of account #
              <input name="last4" defaultValue={account.last4 ?? ""} maxLength={4} className={`w-24 ${INPUT}`} />
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
              <input type="checkbox" checked={showDebitCard} onChange={(e) => setShowDebitCard(e.target.checked)} />
              Linked card?
            </label>
            {showDebitCard && (
              <>
                <label className={LABEL}>
                  Card type
                  <Dropdown
                    name="debit_card_network"
                    options={["Visa", "Mastercard", "Amex", "Discover"].map((n) => ({ value: n, label: n }))}
                    defaultValue={account.debit_card_network ?? "Visa"}
                  />
                </label>
                <label className={LABEL}>
                  Last 4 of card
                  <input name="debit_card_last4" defaultValue={account.debit_card_last4 ?? ""} maxLength={4} className={`w-24 ${INPUT}`} />
                </label>
              </>
            )}
          </div>
        )}

        {(cfg.showsMinCash || cfg.showsDebitCardLast4) && (
          <div className="flex flex-wrap items-end gap-3">
            {cfg.showsMinCash && (
              <label className={LABEL}>
                Minimum-cash threshold
                <input type="number" step="0.01" name="min_cash" defaultValue={account.min_cash ?? ""} className={`w-28 ${INPUT}`} />
              </label>
            )}
            {cfg.showsDebitCardLast4 && (
              <label className={LABEL}>
                Debit-card last 4
                <input name="debit_card_last4" defaultValue={account.debit_card_last4 ?? ""} maxLength={4} className={`w-24 ${INPUT}`} />
              </label>
            )}
          </div>
        )}

        {cfg.showsAnnualLimit && (
          <label className={LABEL}>
            Annual limit
            <input
              type="number"
              step="0.01"
              name="annual_contribution_limit"
              defaultValue={account.annual_contribution_limit ?? ""}
              className={`w-28 ${INPUT}`}
            />
          </label>
        )}

        {cfg.isHoldingsToggle && (
          <div className="rounded-lg border border-border bg-card-soft p-3">
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <input type="checkbox" name="uses_holdings" checked={usesHoldings} onChange={(e) => setUsesHoldings(e.target.checked)} />
              Track individual shares (unchecked = a single lump balance)
            </label>
            {!usesHoldings && (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className={LABEL}>
                  Total value
                  <input type="number" step="0.01" name="balance" defaultValue={account.balance ?? 0} className={`w-32 ${INPUT}`} />
                </label>
                <label className={LABEL}>
                  <span className="flex items-center gap-1">
                    Total cost basis
                    <Tooltip text="What you've put in overall — used to show growth vs. contributions." />
                  </span>
                  <input type="number" step="0.01" name="starting_contributed" defaultValue={account.starting_contributed ?? 0} className={`w-32 ${INPUT}`} />
                </label>
              </div>
            )}
          </div>
        )}

        {cfg.showsSalaryAndMatch && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card-soft p-3">
            <label className={LABEL}>
              Salary (annual)
              <input type="number" step="0.01" name="salary" defaultValue={account.salary ?? ""} className={`w-32 ${INPUT}`} />
            </label>
            <Employer401kMatchFields
              tier1Default={account.match_tier1_pct ?? undefined}
              tier2RateDefault={account.match_tier2_rate_pct ?? undefined}
              tier2LimitDefault={account.match_tier2_limit_pct ?? undefined}
            />
          </div>
        )}

        {cfg.showsNotes && (
          <label className={LABEL}>
            Notes
            <textarea name="notes" defaultValue={account.notes ?? ""} rows={2} className={`${INPUT} resize-none`} />
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="submit" className={BTN_SOLID}>
            Save
          </button>
        </div>
      </ActionForm>
    </section>
  );
}
