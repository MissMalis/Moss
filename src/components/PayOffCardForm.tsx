"use client";

import { useState } from "react";
import { payOffCard } from "@/lib/actions/cards";
import { Dropdown } from "@/components/Dropdown";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { BTN_SOLID, INPUT, LABEL, ROW } from "@/lib/ui";

interface SweptCharge {
  id: string;
  name: string;
  amount: number;
  spent_on: string;
  card_id: string;
}
interface CardLike {
  id: string;
  name: string;
  account_id: string | null;
}
interface LiabilityAccountLike {
  id: string;
  name: string;
  balance: number;
}

/**
 * Rev 07 #9: picking a swept transaction below autofills which card/
 * liability account this payoff applies to (and sums the checked amounts
 * into "Amount paid", still freely editable for a custom amount).
 */
export function PayOffCardForm({
  bufferAccountId,
  recentSwept,
  cards,
  liabilityAccounts,
}: {
  bufferAccountId: string;
  recentSwept: SweptCharge[];
  cards: CardLike[];
  liabilityAccounts: LiabilityAccountLike[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const accountOptions = liabilityAccounts.map((a) => ({ value: a.id, label: `${a.name} (${formatMoney(a.balance)})` }));

  function toggle(charge: SweptCharge, checked: boolean) {
    const next = checked ? [...selectedIds, charge.id] : selectedIds.filter((id) => id !== charge.id);
    setSelectedIds(next);
    const selectedCharges = recentSwept.filter((c) => next.includes(c.id));
    const sum = selectedCharges.reduce((s, c) => s + c.amount, 0);
    setAmount(sum > 0 ? sum.toFixed(2) : "");
    const firstCard = selectedCharges[0] ? cardById.get(selectedCharges[0].card_id) : null;
    if (firstCard?.account_id) setAccountId(firstCard.account_id);
  }

  if (liabilityAccounts.length === 0) {
    return (
      <p className="mt-4 border-t border-border pt-4 text-[13px] text-ink-3">
        Add the card&apos;s balance as a liability account in Net worth first.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {recentSwept.length === 0 ? (
        <p className="mb-3 text-[13px] text-ink-3">Nothing swept yet.</p>
      ) : (
        <div className="mb-3 space-y-1">
          {recentSwept.map((c) => {
            const card = cardById.get(c.card_id);
            return (
              <label key={c.id} className={`${ROW} flex cursor-pointer items-center gap-3`}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.id)}
                  onChange={(e) => toggle(c, e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-border-strong accent-moss"
                  aria-label={`Include ${c.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">{c.name}</p>
                  <p className="truncate text-[11.5px] text-ink-3">
                    {card?.name ?? "—"} · {formatShortDateLabel(c.spent_on)}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] text-ink tabular-nums">{formatMoney(c.amount)}</span>
              </label>
            );
          })}
        </div>
      )}

      <form action={payOffCard} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="buffer_account_id" value={bufferAccountId} />
        <label className={LABEL}>
          Card
          <Dropdown
            name="liability_account_id"
            options={accountOptions}
            value={accountId}
            onChange={setAccountId}
            placeholder="Pick a card"
          />
        </label>
        <label className={LABEL}>
          Amount paid
          <input
            type="number"
            step="0.01"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className={`w-28 ${INPUT}`}
          />
        </label>
        <button type="submit" className={BTN_SOLID}>
          Confirm paid
        </button>
      </form>
    </div>
  );
}
