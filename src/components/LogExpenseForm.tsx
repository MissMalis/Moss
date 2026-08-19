"use client";

import { useState } from "react";
import { createPurchase } from "@/lib/actions/income";
import { Dropdown } from "@/components/Dropdown";
import { Tooltip } from "@/components/Tooltip";
import type { PayableAccountOption } from "@/lib/payable-accounts";
import { BTN_SOLID, INPUT, LABEL } from "@/lib/ui";

interface CategoryOption {
  id: string;
  name: string;
}

/** Rev 07 #4: "Paid with" lists the user's actual payable accounts (name · masked last4), not generic payment-source type names. */
export function LogExpenseForm({
  payableAccounts,
  categories = [],
  taxRatePct = null,
  location = null,
}: {
  payableAccounts: PayableAccountOption[];
  categories?: CategoryOption[];
  taxRatePct?: number | null;
  location?: string | null;
}) {
  const [selectedId, setSelectedId] = useState(payableAccounts[0]?.id ?? "");
  const selected = payableAccounts.find((p) => p.id === selectedId) ?? null;

  return (
    <form action={createPurchase} className="flex flex-wrap items-end gap-3">
      <label className={LABEL}>
        What
        <input name="name" required placeholder="Coffee" className={INPUT} />
      </label>
      <label className={LABEL}>
        Amount
        <input type="number" step="0.01" name="amount" required className={`w-28 ${INPUT}`} />
      </label>
      <label className={LABEL}>
        Date
        <input
          type="date"
          name="spent_on"
          defaultValue={new Date().toISOString().slice(0, 10)}
          style={{ colorScheme: "light" }}
          className={INPUT}
        />
      </label>
      <label className={LABEL}>
        Category
        <Dropdown name="category" options={categories.map((c) => ({ value: c.name, label: c.name }))} defaultValue={categories[0]?.name ?? ""} />
      </label>
      <label className={LABEL}>
        Paid with
        <Dropdown
          options={payableAccounts.map((p) => ({ value: p.id, label: p.label }))}
          value={selectedId}
          onChange={setSelectedId}
          placeholder="No payable accounts yet"
        />
      </label>
      <input type="hidden" name="payment_source" value={selected?.paymentSource ?? "checking"} />
      <input type="hidden" name="source_account_id" value={selected?.sourceAccountId ?? ""} />
      <input type="hidden" name="card_id" value={selected?.cardId ?? ""} />

      <label className="flex items-center gap-1.5 pb-2 text-[12.5px] text-ink-2">
        <input type="checkbox" name="apply_tax" />
        Add tax
        <Tooltip
          text={
            taxRatePct
              ? `Applies your ${location ?? "location"}'s ${taxRatePct}% sales-tax rate to the amount above.`
              : "Applies your location's sales-tax rate to the amount above — set one in Settings."
          }
        />
      </label>

      <div className="mt-1 flex w-full justify-end">
        <button type="submit" className={BTN_SOLID}>
          Log the expense
        </button>
      </div>

      {selected?.paymentSource === "rewards_card" ? (
        <p className="w-full text-[12.5px] text-ink-3">
          Quarantined from Safe to spend — shows up in Sweep to pay off later.
        </p>
      ) : (
        selected && selected.paymentSource !== "checking" && (
          <p className="w-full text-[12.5px] text-ink-3">
            Comes out of that account&apos;s own balance — Safe to spend won&apos;t move.
          </p>
        )
      )}
    </form>
  );
}
