"use client";

import { useState } from "react";
import { createPurchase } from "@/lib/actions/income";
import { BTN_SOLID, INPUT, LABEL } from "@/lib/ui";

type PaymentSource = "checking" | "investing" | "stored_value";

interface AccountOption {
  id: string;
  name: string;
}

export function LogExpenseForm({
  investingAccounts,
  storedValueAccounts,
}: {
  investingAccounts: AccountOption[];
  storedValueAccounts: AccountOption[];
}) {
  const [source, setSource] = useState<PaymentSource>("checking");

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
          className={INPUT}
        />
      </label>
      <label className={LABEL}>
        Category
        <input name="category" defaultValue="Play" className={`w-28 ${INPUT}`} />
      </label>
      <label className={LABEL}>
        Paid with
        <select
          name="payment_source"
          value={source}
          onChange={(e) => setSource(e.target.value as PaymentSource)}
          className={INPUT}
        >
          <option value="checking">Checking</option>
          {investingAccounts.length > 0 && <option value="investing">Investing cash sleeve</option>}
          {storedValueAccounts.length > 0 && <option value="stored_value">Stored-value card</option>}
        </select>
      </label>

      {source === "investing" && (
        <label className={LABEL}>
          Account
          <select name="source_account_id" className={INPUT}>
            {investingAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {source === "stored_value" && (
        <label className={LABEL}>
          Card
          <select name="source_account_id" className={INPUT}>
            {storedValueAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" className={BTN_SOLID}>
        Log the expense
      </button>

      {source !== "checking" && (
        <p className="w-full text-[12.5px] text-ink-3">
          Comes out of that account&apos;s own balance — Safe to spend won&apos;t move.
        </p>
      )}
    </form>
  );
}
