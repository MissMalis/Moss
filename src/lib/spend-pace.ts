// Today §2.4: the Rocket-Money-style "$68/day · 14 days left" pill.

export function daysUntil(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00");
  const to = new Date(toISO + "T00:00:00");
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

/** Remaining Safe-to-Spend divided by days left in the period. Never negative or divides by zero. */
export function dollarsPerDay(safeToSpend: number, daysLeft: number): number {
  const spendable = Math.max(0, safeToSpend);
  if (daysLeft <= 0) return spendable;
  return spendable / daysLeft;
}
