"use client";

import { useState } from "react";
import { updateAccount } from "@/lib/actions/accounts";
import { accountTypeLabel } from "@/lib/net-worth";
import { getLiabilityFieldConfig } from "@/lib/account-field-config";
import { formatShortDateLabel } from "@/lib/format";
import { IconPicker } from "@/components/IconPicker";
import { ActionForm } from "@/components/ActionForm";
import { BTN_GHOST, BTN_SOLID, CARD, CARD_HEADER, INPUT, LABEL } from "@/lib/ui";

type LiabilityAccountRow = {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  apr_pct: number | null;
  last4: string | null;
  loan_term_months: number | null;
  balance_updated_at: string | null;
};

function mask(last4: string | null): string | null {
  return last4 ? `x${last4}` : null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-[13.5px] last:border-0">
      <span className="text-ink-2">{label}</span>
      <span className="text-ink tabular-nums">{value}</span>
    </div>
  );
}

/** Rev 06b v2 §3/§4/§8: a LIABILITY's detail/edit — read-only by default. Balance/APR live on the loans below; this covers name/type/icon/last4/term. */
export function LiabilityDetailsSection({ account }: { account: LiabilityAccountRow }) {
  const [editing, setEditing] = useState(false);
  const cfg = getLiabilityFieldConfig(account.type);

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
          <Row label="As of" value={account.balance_updated_at ? formatShortDateLabel(account.balance_updated_at.slice(0, 10)) : null} />
          {cfg.showsCreditCardLast4 && <Row label="Card" value={mask(account.last4)} />}
          {cfg.showsTerm && <Row label="Term" value={account.loan_term_months ? `${Math.round(account.loan_term_months / 12)} years` : null} />}
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

        {cfg.showsCreditCardLast4 && (
          <label className={LABEL}>
            Last 4
            <input name="last4" defaultValue={account.last4 ?? ""} maxLength={4} className={`w-24 ${INPUT}`} />
          </label>
        )}

        {cfg.showsTerm && (
          <label className={LABEL}>
            Term (years)
            <input type="number" name="term_years" defaultValue={account.loan_term_months ? account.loan_term_months / 12 : ""} className={`w-20 ${INPUT}`} />
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
