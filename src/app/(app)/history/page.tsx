import { closeElapsedPeriods } from "@/lib/data/close-periods";
import { listClosedPayPeriods } from "@/lib/data/history";
import { listCategories } from "@/lib/data/recurring";
import { updateHistoryLineItem } from "@/lib/actions/history";
import { formatDateRange, formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { SpendingRing, type RingCategory } from "@/components/SpendingRing";
import { EmptyState } from "@/components/EmptyState";
import { BTN_GHOST, CARD, INPUT } from "@/lib/ui";

const DEFAULT_CATEGORY_EMOJI = "💳";

interface Snapshot {
  earmarked: { name: string; occDate: string; amount: number }[];
  purchases: { name: string; amount: number; spent_on: string; category: string }[];
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  await closeElapsedPeriods();
  const [periods, categories] = await Promise.all([listClosedPayPeriods(), listCategories()]);

  if (periods.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-[28px] font-medium text-ink">History</h1>
          <p className="mt-1 text-[13px] text-ink-2">Closed pay periods, frozen as they were.</p>
        </div>
        <EmptyState
          emoji="📬"
          title="No closed pay periods yet"
          hint="Your first will appear here after a window ends."
        />
      </div>
    );
  }

  const selected = periods.find((p) => p.pay_date === period) ?? periods[0];
  const snapshot = selected.snapshot as unknown as Snapshot | null;
  const emojiByCategory = new Map(categories.map((c) => [c.name, c.emoji ?? DEFAULT_CATEGORY_EMOJI]));

  const byCategory = new Map<string, number>();
  for (const e of snapshot?.earmarked ?? []) {
    byCategory.set("Bills", (byCategory.get("Bills") ?? 0) + e.amount);
  }
  for (const p of snapshot?.purchases ?? []) {
    const name = p.category || "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + p.amount);
  }
  const spendingByCategory: RingCategory[] = Array.from(byCategory.entries())
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({ name, amount, emoji: emojiByCategory.get(name) ?? DEFAULT_CATEGORY_EMOJI }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">History</h1>
        <p className="mt-1 text-[13px] text-ink-2">Closed pay periods, frozen as they were — viewable and editable, never deleted.</p>
      </div>

      <form className="flex items-end gap-2">
        <select name="period" defaultValue={selected.pay_date} className={INPUT}>
          {periods.map((p) => (
            <option key={p.id} value={p.pay_date}>
              {formatDateRange(p.window_start, p.window_end)} · paid {formatShortDateLabel(p.pay_date)}
            </option>
          ))}
        </select>
        <button type="submit" className={BTN_GHOST}>
          View
        </button>
      </form>

      <section>
        <p className="text-[12.5px] uppercase tracking-wide text-ink-3">
          {formatDateRange(selected.window_start, selected.window_end)}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={CARD}>
            <p className="text-[12px] text-ink-3">Income</p>
            <Money value={selected.net_income ?? 0} size="stat" />
          </div>
          <div className={CARD}>
            <p className="text-[12px] text-ink-3">Bills</p>
            <Money value={selected.earmarked_total ?? 0} size="stat" />
          </div>
          <div className={CARD}>
            <p className="text-[12px] text-ink-3">Spending</p>
            <Money value={selected.purchases_total ?? 0} size="stat" />
          </div>
          <div className={CARD}>
            <p className="text-[12px] text-ink-3">Left for savings</p>
            <Money value={selected.safe_to_spend ?? 0} size="stat" className="text-moss" />
          </div>
        </div>
      </section>

      {spendingByCategory.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-[18px] font-medium text-ink">Where it went</h2>
          <SpendingRing data={spendingByCategory} />
        </section>
      )}

      {snapshot && (snapshot.earmarked.length > 0 || snapshot.purchases.length > 0) && (
        <section>
          <h2 className="mb-3 font-display text-[18px] font-medium text-ink">Line items</h2>
          <div className="space-y-3 text-[13px]">
            {snapshot.earmarked.length > 0 && (
              <div>
                <p className="text-[11.5px] uppercase tracking-wide text-ink-3">Earmarked</p>
                {snapshot.earmarked.map((e, i) => (
                  <details key={i} className="group py-0.5">
                    <summary className="flex cursor-pointer list-none justify-between text-ink-2">
                      <span>
                        {e.name} <span className="text-ink-3">· {formatShortDateLabel(e.occDate)}</span>
                      </span>
                      <span className="tabular-nums">{formatMoney(e.amount)}</span>
                    </summary>
                    <form action={updateHistoryLineItem} className="mt-1.5 flex items-center gap-2 pl-2">
                      <input type="hidden" name="pay_period_id" value={selected.id} />
                      <input type="hidden" name="kind" value="earmarked" />
                      <input type="hidden" name="index" value={i} />
                      <input name="name" defaultValue={e.name} required className={`w-40 py-1 ${INPUT}`} />
                      <button type="submit" className={`${BTN_GHOST} py-1`}>
                        Save name
                      </button>
                    </form>
                  </details>
                ))}
              </div>
            )}
            {snapshot.purchases.length > 0 && (
              <div>
                <p className="text-[11.5px] uppercase tracking-wide text-ink-3">Purchases</p>
                {snapshot.purchases.map((pu, i) => (
                  <details key={i} className="group py-0.5">
                    <summary className="flex cursor-pointer list-none justify-between text-ink-2">
                      <span>
                        {pu.name} <span className="text-ink-3">· {pu.category}</span>
                      </span>
                      <span className="tabular-nums">{formatMoney(pu.amount)}</span>
                    </summary>
                    <form action={updateHistoryLineItem} className="mt-1.5 flex items-center gap-2 pl-2">
                      <input type="hidden" name="pay_period_id" value={selected.id} />
                      <input type="hidden" name="kind" value="purchases" />
                      <input type="hidden" name="index" value={i} />
                      <input name="name" defaultValue={pu.name} required className={`w-40 py-1 ${INPUT}`} />
                      <input name="category" defaultValue={pu.category} className={`w-28 py-1 ${INPUT}`} />
                      <button type="submit" className={`${BTN_GHOST} py-1`}>
                        Save
                      </button>
                    </form>
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
