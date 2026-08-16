// Rev 04 §4: Move money. A transfer relocates money between two of the
// user's own accounts — it must never be treated as an expense (net worth,
// spend reports, budgets, and the ring all ignore it entirely, since they
// only ever read from `purchases`). The one place it DOES matter is Safe
// to Spend: money that leaves the spendable "checking" pool is no longer
// available to spend, exactly like a checking-sourced purchase.

export interface TransferLike {
  from_account_id: string;
  to_account_id: string;
  amount: number;
}

export interface CheckingAccountLike {
  id: string;
  type: string;
  is_forbidden_money: boolean;
}

// Savings deliberately excluded — like HYSA, it isn't the day-to-day
// spendable pool, so moving money into/out of it shouldn't move Safe to
// Spend (only Checking, or legacy "Cash" rows predating the Rev 06b split, do).
const CHECKING_TYPES = new Set(["Cash", "Checking"]);

/** The spendable base — a Checking/legacy-Cash account that isn't the Sweep buffer/channeling reserve. */
export function isCheckingAccount(a: CheckingAccountLike): boolean {
  return CHECKING_TYPES.has(a.type) && !a.is_forbidden_money;
}

/**
 * Net amount to add to `purchasesTotal` in the Safe-to-Spend formula.
 * Checking -> elsewhere: reduces spendable money (adds, since
 * purchasesTotal is subtracted). Elsewhere -> checking: money becomes
 * spendable again (subtracts). Neither side checking: no effect.
 */
export function transfersSafeToSpendImpact(
  transfers: TransferLike[],
  accounts: CheckingAccountLike[],
): number {
  const checkingIds = new Set(accounts.filter(isCheckingAccount).map((a) => a.id));
  let total = 0;
  for (const t of transfers) {
    const fromChecking = checkingIds.has(t.from_account_id);
    const toChecking = checkingIds.has(t.to_account_id);
    if (fromChecking && !toChecking) total += t.amount;
    else if (!fromChecking && toChecking) total -= t.amount;
  }
  return total;
}
