"use client";

import { useMemo, useState } from "react";
import { createCardCharge } from "@/lib/actions/cards";
import { bestCardForCategory, type CardLike, type MultiplierLike } from "@/lib/cards";
import { BTN_SOLID, INPUT, LABEL } from "@/lib/ui";

interface Category {
  id: string;
  name: string;
  emoji: string | null;
}

export function LogCardChargeForm({
  cards,
  multipliers,
  categories,
}: {
  cards: CardLike[];
  multipliers: MultiplierLike[];
  categories: Category[];
}) {
  const [categoryId, setCategoryId] = useState<string>("");

  const best = useMemo(
    () => bestCardForCategory(cards, multipliers, categoryId || null),
    [cards, multipliers, categoryId],
  );

  return (
    <form action={createCardCharge} className="flex flex-wrap items-end gap-3">
      <label className={LABEL}>
        What
        <input name="name" required placeholder="Groceries" className={INPUT} />
      </label>
      <label className={LABEL}>
        Amount
        <input type="number" step="0.01" name="amount" required className={`w-28 ${INPUT}`} />
      </label>
      <label className={LABEL}>
        Date
        <input type="date" name="spent_on" defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} />
      </label>
      <label className={LABEL}>
        Category
        <select
          name="category_id"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={INPUT}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        Card
        <select name="card_id" className={INPUT}>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {best?.card.id === c.id ? ` — best (${best.multiplier}x)` : ""}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={BTN_SOLID}>
        Log the charge
      </button>
      {best && (
        <p className="w-full text-[12.5px] text-ink-3">
          {best.isCategoryMatch
            ? `Best card for this: ${best.card.name} at ${best.multiplier}x.`
            : `No category bonus set — ${best.card.name} earns its base ${best.multiplier}x.`}
        </p>
      )}
    </form>
  );
}
