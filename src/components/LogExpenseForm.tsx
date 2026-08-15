"use client";

import { useState } from "react";
import { createPurchase } from "@/lib/actions/income";
import { BTN_SOLID, INPUT, LABEL } from "@/lib/ui";

type PaymentSource = "checking" | "investing" | "stored_value" | "rewards_card";

interface AccountOption {
  id: string;
  name: string;
}

interface CardOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export function LogExpenseForm({
  investingAccounts,
  storedValueAccounts,
  cards = [],
  categories = [],
}: {
  investingAccounts: AccountOption[];
  storedValueAccounts: AccountOption[];
  cards?: CardOption[];
  categories?: CategoryOption[];
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
          style={{ colorScheme: "light" }}
          className={INPUT}
        />
      </label>
      <label className={LABEL}>
        Category
        <select name="category" defaultValue={categories[0]?.name ?? ""} className={`w-32 ${INPUT}`}>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
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
          {storedValueAccounts.length > 0 && <option value="stored_value">Prepaid / reloadable</option>}
          {cards.length > 0 && <option value="rewards_card">Rewards card</option>}
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

      {source === "rewards_card" && (
        <label className={LABEL}>
          Card
          <select name="card_id" className={INPUT}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="submit" className={BTN_SOLID}>
        Log the expense
      </button>

      {source === "rewards_card" ? (
        <p className="w-full text-[12.5px] text-ink-3">
          Quarantined from Safe to spend — shows up in Sweep to pay off later.
        </p>
      ) : (
        source !== "checking" && (
          <p className="w-full text-[12.5px] text-ink-3">
            Comes out of that account&apos;s own balance — Safe to spend won&apos;t move.
          </p>
        )
      )}
    </form>
  );
}
