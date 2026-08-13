import Link from "next/link";
import { getTodaySnapshot } from "@/lib/data/today";
import { createPurchase, deletePurchase, postPaycheck } from "@/lib/actions/income";

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function TodayPage() {
  const snap = await getTodaySnapshot();

  if (!snap.hasPrimaryIncome) {
    return (
      <div className="rounded-lg border border-line bg-panel p-6 text-dim">
        Add an income source in{" "}
        <Link href="/settings" className="text-gold hover:underline">
          Settings
        </Link>{" "}
        to see Safe to Spend.
      </div>
    );
  }

  if (!snap.window) {
    return (
      <div className="rounded-lg border border-line bg-panel p-6 text-dim">
        No pay window covers today for your income schedule — check the anchor date in{" "}
        <Link href="/settings" className="text-gold hover:underline">
          Settings
        </Link>
        .
      </div>
    );
  }

  const { window, income, rollover, earmarked, autoReserve, purchasesTotal, safeToSpend, purchases, earmarkedItems } =
    snap;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm uppercase tracking-wide text-dim">
          Safe to Spend · {window.start} – {window.end}
        </p>
        <p
          className={`font-display text-7xl ${safeToSpend >= 0 ? "text-gold" : "text-blood-light"}`}
        >
          {money(safeToSpend)}
        </p>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-dim hover:text-text">
            Show the math
          </summary>
          <div className="mt-3 space-y-1 rounded-lg border border-line bg-panel p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-dim">Income</span>
              <span className="text-text">{money(income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dim">+ Rollover from last period</span>
              <span className="text-text">{money(rollover)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dim">− Earmarked bills</span>
              <span className="text-text">{money(earmarked)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dim">− Auto-reserve</span>
              <span className="text-text">{money(autoReserve.reserve)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dim">− Purchases logged</span>
              <span className="text-text">{money(purchasesTotal)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium">
              <span className="text-text">= Safe to Spend</span>
              <span className="text-gold">{money(safeToSpend)}</span>
            </div>
          </div>
        </details>

        {autoReserve.reasons.length > 0 && (
          <div className="mt-3 space-y-1 rounded-lg border border-warn/40 bg-panel p-4 text-sm">
            <p className="text-warn">Auto-reserve is holding back {money(autoReserve.reserve)}:</p>
            {autoReserve.reasons.map((r) => (
              <p key={r.payDate} className="text-dim">
                Pay date {r.payDate} is short {money(r.shortfall)}
              </p>
            ))}
          </div>
        )}

        {!snap.alreadyPosted && (
          <form action={postPaycheck} className="mt-4">
            <input type="hidden" name="income_source_id" value={snap.primarySource!.id} />
            <input type="hidden" name="pay_date" value={window.payDate} />
            <input type="hidden" name="window_start" value={window.start} />
            <input type="hidden" name="window_end" value={window.end} />
            <input type="hidden" name="net_income" value={income} />
            <button
              type="submit"
              className="rounded-md bg-sage px-4 py-2 text-sm text-bg hover:opacity-90"
            >
              Post paycheck ({window.payDate}) — credits deductions to net worth
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl text-text">
          Earmarked this period <Link href="/recurring" className="text-sm text-faint hover:text-text">(manage →)</Link>
        </h2>
        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {earmarkedItems.length === 0 && (
            <p className="p-4 text-sm text-faint">Nothing earmarked this period.</p>
          )}
          {earmarkedItems
            .slice()
            .sort((a, b) => a.occDate.localeCompare(b.occDate))
            .map((o) => (
              <div
                key={`${o.item.id}|${o.occDate}`}
                className={`flex items-center justify-between p-3 text-sm ${o.skipped ? "opacity-50" : ""}`}
              >
                <span className="text-text">
                  {o.item.name} <span className="text-faint">· {o.occDate}</span>
                </span>
                <span className={o.posted ? "text-sage" : "text-dim"}>
                  {money(o.amount)}
                  {o.skipped && " (skipped)"}
                </span>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl text-text">Purchases</h2>
        <form action={createPurchase} className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-faint">
            Name
            <input
              name="name"
              required
              className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-faint">
            Amount
            <input
              type="number"
              step="0.01"
              name="amount"
              required
              className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-faint">
            Date
            <input
              type="date"
              name="spent_on"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-faint">
            Category
            <input
              name="category"
              defaultValue="Play"
              className="w-28 rounded-md border border-line bg-panel2 px-2 py-1.5 text-sm text-text outline-none focus:border-gold"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-blood px-4 py-1.5 text-sm text-text hover:bg-blood-light"
          >
            Log
          </button>
        </form>

        <div className="divide-y divide-line rounded-lg border border-line bg-panel">
          {purchases.length === 0 && (
            <p className="p-4 text-sm text-faint">Nothing logged this period yet.</p>
          )}
          {purchases.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 text-sm">
              <span className="text-text">
                {p.name} <span className="text-faint">· {p.spent_on} · {p.category}</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="text-text">{money(p.amount)}</span>
                <form action={deletePurchase}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs text-faint hover:text-warn">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
