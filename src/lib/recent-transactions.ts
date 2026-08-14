// Today §2.6 "Recent": Rocket-Money-style grouping — a greyed date header
// per day, rows underneath with no per-row date.

export interface TransactionLike {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO
  kind: "income" | "outflow";
  category: string | null;
}

export interface DateGroup {
  date: string;
  items: TransactionLike[];
}

/** Sorts newest-first, then buckets consecutive same-date items under one header. */
export function groupByDate(transactions: TransactionLike[]): DateGroup[] {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const groups: DateGroup[] = [];
  for (const t of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) {
      last.items.push(t);
    } else {
      groups.push({ date: t.date, items: [t] });
    }
  }
  return groups;
}
