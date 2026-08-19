"use client";

import { useState } from "react";
import { payOffCard } from "@/lib/actions/cards";
import { Dropdown } from "@/components/Dropdown";
import { IconCircle } from "@/components/IconCircle";
import { formatMoney, formatShortDateLabel, formatLast4 } from "@/lib/format";
import { BTN_SOLID, INPUT, LABEL, ROW, SCROLL_LIST } from "@/lib/ui";

interface SweptCharge {
  id: string;
  name: string;
  amount: number;
  spent_on: string;
  card_id: string;
  category_id: string | null;
}
interface CardLike {
  id: string;
  name: string;
  last4: string | null;
  account_id: string | null;
}
interface LiabilityAccountLike {
  id: string;
  name: string;
  last4: string | null;
  balance: number;
}
interface CategoryLike {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

/**
 * Rev 07 #9: picking a swept transaction below autofills which card/
 * liability account this payoff applies to (and sums the checked amounts
 * into "Amount paid", still freely editable for a custom amount).
 * Rev 08 #1: rows also carry their category symbol, same as everywhere else.
 */
export function PayOffCardForm({
  bufferAccountId,
  recentSwept,
  cards,
  liabilityAccounts,
  categories,
}: {
  bufferAccountId: string;
  recentSwept: SweptCharge[];
  cards: CardLike[];
  liabilityAccounts: LiabilityAccountLike[];
  categories: CategoryLike[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const cardByAccountId = new Map(cards.filter((c) => c.account_id).map((c) => [c.account_id!, c]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  // Rev 08 #14: prefer the linked card's own vendor name + last4 (e.g.
  // "Amex Gold ···· 1009") over the liability account's own fields, since
  // that's the identity a person actually recognizes their card by.
  const accountOptions = liabilityAccounts.map((a) => {
    const card = cardByAccountId.get(a.id);
    const name = card?.name ?? a.name;
    const last4 = formatLast4(card?.last4 ?? a.last4);
    return { value: a.id, label: `${name}${last4 ? ` ${last4}` : ""} · ${formatMoney(a.balance)}` };
  });

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
      <div className={`mb-3 space-y-1 ${SCROLL_LIST}`}>
        {recentSwept.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nothing swept yet.</p>
        ) : (
          recentSwept.map((c) => {
            const card = cardById.get(c.card_id);
            const category = c.category_id ? categoryById.get(c.category_id) : null;
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
                <IconCircle value={category?.emoji ?? null} label={category?.name ?? c.name} color={category?.color} variant="tinted" size="sm" />
                <span className="shrink-0 text-[13px] text-ink tabular-nums">{formatMoney(c.amount)}</span>
              </label>
            );
          })
        )}
      </div>

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
