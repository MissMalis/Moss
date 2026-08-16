"use client";

import { useState } from "react";
import { updateAccount } from "@/lib/actions/accounts";
import { ACCOUNT_TYPES } from "@/lib/account-types";
import { accountTypeLabel, HOLDINGS_TYPES } from "@/lib/net-worth";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { IconPicker } from "@/components/IconPicker";
import { ActionForm } from "@/components/ActionForm";
import { Tooltip } from "@/components/Tooltip";
import { BTN_GHOST, BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL } from "@/lib/ui";

type AccountRow = {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  balance: number;
  starting_contributed: number;
  apy_pct: number | null;
  apr_pct: number | null;
  min_cash: number | null;
  annual_contribution_limit: number | null;
  last4: string | null;
  debit_card_last4: string | null;
  uses_holdings: boolean;
  lump_cost_basis: number | null;
  salary: number | null;
  match_tier1_pct: number | null;
  match_tier2_limit_pct: number | null;
  match_tier2_rate_pct: number | null;
  is_credit_card: boolean;
  balance_updated_at: string | null;
};

const INVESTING_TOGGLE_TYPES = new Set(["401(k)", "Traditional IRA", "Roth IRA", "Taxable Brokerage"]);

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
 * Rev 06b §3: read-only by default (prevents accidental edits from live
 * inputs) with an Edit button that opens the full form — covers name/type/
 * icon plus every type-specific field the wizard captures.
 */
export function AccountDetailsSection({ account }: { account: AccountRow }) {
  const [editing, setEditing] = useState(false);
  const isHSA = account.type === "HSA";
  const isInvesting = INVESTING_TOGGLE_TYPES.has(account.type);
  const [usesHoldings, setUsesHoldings] = useState(account.uses_holdings);
  const [isCreditCard, setIsCreditCard] = useState(account.is_credit_card);
  const [showDebitCard, setShowDebitCard] = useState(!!account.debit_card_last4);

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
          {(!HOLDINGS_TYPES.has(account.type) || isHSA || !account.uses_holdings) && (
            <Row label={isHSA ? "Cash sleeve" : "Balance"} value={formatMoney(account.balance ?? 0)} />
          )}
          <Row label="As of" value={account.balance_updated_at ? formatShortDateLabel(account.balance_updated_at.slice(0, 10)) : null} />
          <Row label="Last 4" value={account.last4} />
          <Row label="Linked card" value={account.debit_card_last4 ? `···· ${account.debit_card_last4}` : null} />
          <Row label="APY" value={account.apy_pct ? `${account.apy_pct}%` : null} />
          <Row label="APR" value={account.apr_pct ? `${account.apr_pct}%` : null} />
          <Row label="Minimum-cash threshold" value={account.min_cash != null ? formatMoney(account.min_cash) : null} />
          <Row label="Annual limit" value={account.annual_contribution_limit != null ? formatMoney(account.annual_contribution_limit) : null} />
          <Row label="Total contributions" value={account.starting_contributed ? formatMoney(account.starting_contributed) : null} />
          {isInvesting && <Row label="Tracking" value={account.uses_holdings ? "Individual shares" : "Lump total"} />}
          {!account.uses_holdings && isInvesting && (
            <Row label="Cost basis" value={account.lump_cost_basis != null ? formatMoney(account.lump_cost_basis) : null} />
          )}
          <Row label="Salary" value={account.salary != null ? formatMoney(account.salary) + "/yr" : null} />
          {account.match_tier1_pct != null && (
            <Row
              label="Employer match"
              value={`100% up to ${account.match_tier1_pct}%, then ${account.match_tier2_rate_pct}% up to ${account.match_tier2_limit_pct}%`}
            />
          )}
          <Row label="Credit card" value={account.is_credit_card ? "Yes" : null} />
        </div>
      </section>
    );
  }

  return (
    <section className={CARD}>
      <p className={CARD_HEADER}>Details</p>
      <ActionForm action={updateAccount} onSuccess={() => setEditing(false)} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={account.id} />
        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL}>
            Icon
            <IconPicker name="icon" label={account.name} defaultValue={account.icon} />
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
        </div>

        {(!isInvesting || !usesHoldings) && (
          <div className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              {isHSA ? "Cash sleeve" : "Balance"}
              <input type="number" step="0.01" name="balance" defaultValue={account.balance ?? 0} className={`w-32 ${INPUT}`} />
            </label>
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
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className={LABEL}>
            Last 4
            <input name="last4" defaultValue={account.last4 ?? ""} maxLength={4} className={`w-20 ${INPUT}`} />
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
            <input type="checkbox" checked={showDebitCard} onChange={(e) => setShowDebitCard(e.target.checked)} />
            Linked card?
          </label>
          {showDebitCard && (
            <label className={LABEL}>
              Last 4 of card
              <input name="debit_card_last4" defaultValue={account.debit_card_last4 ?? ""} maxLength={4} className={`w-20 ${INPUT}`} />
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
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
          <label className={LABEL}>
            <span className="flex items-center gap-1">
              Total contributions
              <Tooltip text="What you've put in overall, including anything from before Moss — used to show growth vs. contributions." />
            </span>
            <input type="number" step="0.01" name="starting_contributed" defaultValue={account.starting_contributed ?? 0} className={`w-28 ${INPUT}`} />
          </label>
        </div>

        {account.type === "Liabilities" && (
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <input type="checkbox" name="is_credit_card" checked={isCreditCard} onChange={(e) => setIsCreditCard(e.target.checked)} />
            Is it a credit card?
            <Tooltip text="A credit-card liability becomes selectable as a rewards card in Sweep." />
          </label>
        )}

        {isInvesting && (
          <div className="rounded-lg border border-border bg-card-soft p-3">
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <input
                type="checkbox"
                name="uses_holdings"
                checked={usesHoldings}
                onChange={(e) => setUsesHoldings(e.target.checked)}
              />
              Track individual shares (unchecked = a single lump balance)
            </label>
            {!usesHoldings && (
              <label className={`mt-2 ${LABEL}`}>
                Total cost basis
                <input type="number" step="0.01" name="lump_cost_basis" defaultValue={account.lump_cost_basis ?? 0} className={`w-32 ${INPUT}`} />
              </label>
            )}
          </div>
        )}

        {account.type === "401(k)" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className={LABEL}>
              Salary (annual)
              <input type="number" step="0.01" name="salary" defaultValue={account.salary ?? ""} className={`w-28 ${INPUT}`} />
            </label>
            <label className={LABEL}>
              Match: 100% up to
              <input type="number" step="0.1" name="match_tier1_pct" defaultValue={account.match_tier1_pct ?? ""} className={`w-20 ${INPUT}`} />%
            </label>
            <label className={LABEL}>
              then
              <input type="number" step="0.1" name="match_tier2_rate_pct" defaultValue={account.match_tier2_rate_pct ?? ""} className={`w-20 ${INPUT}`} />%
            </label>
            <label className={LABEL}>
              up to
              <input type="number" step="0.1" name="match_tier2_limit_pct" defaultValue={account.match_tier2_limit_pct ?? ""} className={`w-20 ${INPUT}`} />%
            </label>
          </div>
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
