// Pure logic for module 4: best-card suggestion and Cash App reconciliation.
// Sweeps only ever move money into the Forbidden Money account's balance —
// they never touch purchases or the recurring engine, so none of this
// affects Safe-to-Spend (brief §0.2).

export interface CardLike {
  id: string;
  name: string;
  base_multiplier: number;
}

export interface MultiplierLike {
  card_id: string;
  category_id: string;
  multiplier: number;
}

export interface BestCard {
  card: CardLike;
  multiplier: number;
  isCategoryMatch: boolean;
}

/** Which card earns the most for a given category (falls back to each card's base rate). */
export function bestCardForCategory(
  cards: CardLike[],
  multipliers: MultiplierLike[],
  categoryId: string | null,
): BestCard | null {
  if (cards.length === 0) return null;

  const options: BestCard[] = cards.map((card) => {
    const match = categoryId
      ? multipliers.find((m) => m.card_id === card.id && m.category_id === categoryId)
      : undefined;
    return match
      ? { card, multiplier: match.multiplier, isCategoryMatch: true }
      : { card, multiplier: card.base_multiplier, isCategoryMatch: false };
  });

  return options.reduce((best, opt) => (opt.multiplier > best.multiplier ? opt : best));
}

export interface ForbiddenMoneyAccountLike {
  balance: number;
  reconciled_balance: number | null;
}

export interface ReconciliationStatus {
  expected: number;
  actual: number | null;
  shortBy: number;
}

/** Expected (swept total) vs the last confirmed real Cash App balance. */
export function reconciliationStatus(account: ForbiddenMoneyAccountLike): ReconciliationStatus {
  const expected = account.balance;
  const actual = account.reconciled_balance;
  const shortBy = actual == null ? 0 : Math.max(0, expected - actual);
  return { expected, actual, shortBy };
}
