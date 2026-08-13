import Link from "next/link";
import { getTodaySnapshot } from "@/lib/data/today";
import { getNetWorthSummary } from "@/lib/data/net-worth-summary";
import { getSettings } from "@/lib/data/settings";
import { createPurchase, deletePurchase, postPaycheck } from "@/lib/actions/income";
import { formatDateRange, formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { Tooltip } from "@/components/Tooltip";
import { SpendingRing } from "@/components/SpendingRing";
import { NetWorthLines } from "@/components/NetWorthLines";
import { EmptyState } from "@/components/EmptyState";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { BTN_SOLID, CARD, INPUT, LABEL, LINK_QUIET, PILL_HOLD, ROW } from "@/lib/ui";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage() {
  const snap = await getTodaySnapshot();

  if (!snap.hasPrimaryIncome) {
    return (
      <EmptyState
        emoji="👋"
        title="Add an income source to see Safe to spend"
        hint="Head to Income to get started."
      />
    );
  }

  if (!snap.window) {
    return (
      <EmptyState
        emoji="🗓️"
        title="No pay window covers today"
        hint="Check the anchor date for your income in Income."
      />
    );
  }

  const [netWorthSummary, settings] = await Promise.all([getNetWorthSummary(), getSettings()]);

  const {
    window,
    income,
    rollover,
    earmarked,
    autoReserve,
    purchasesTotal,
    safeToSpend,
    purchases,
    earmarkedItems,
    spendingByCategory,
  } = snap;

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-ink-2">{greeting()}</p>
          <p className="text-[12.5px] text-ink-3">{formatDateRange(window.start, window.end)}</p>
        </div>
        <span className="text-ink-3" aria-hidden>
          🔔
        </span>
      </div>

      <section>
        <p className="text-[13px] text-ink-2">💸 Safe to spend</p>
        <Money value={safeToSpend} size="hero" />

        {autoReserve.reserve > 0 && (
          <div className={`mt-3 ${PILL_HOLD}`}>
            🔒 Holding {formatMoney(autoReserve.reserve)} for next paycheck
            <Tooltip text="A future pay period's bills cost more than that paycheck will bring in, so Moss is setting money aside now instead of letting you spend it and come up short later." />
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] text-ink-3 hover:text-ink-2">
            Show the math
          </summary>
          <div className={`mt-3 space-y-1.5 text-[14px] ${CARD}`}>
            <div className="flex justify-between">
              <span className="text-ink-2">Income</span>
              <span className="text-ink tabular-nums">{formatMoney(income)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">+ Rollover from last period</span>
              <span className="text-ink tabular-nums">{formatMoney(rollover)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">− Earmarked bills</span>
              <span className="text-ink tabular-nums">{formatMoney(earmarked)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1 text-ink-2">
                − Auto-reserve
                <Tooltip text="Looks two paychecks ahead — if a future period's bills exceed that paycheck's income, the shortfall is pulled into today's reserve." />
              </span>
              <span className="text-ink tabular-nums">{formatMoney(autoReserve.reserve)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">− Purchases logged</span>
              <span className="text-ink tabular-nums">{formatMoney(purchasesTotal)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
              <span className="text-ink">= Safe to spend</span>
              <span className="text-ink tabular-nums">{formatMoney(safeToSpend)}</span>
            </div>
          </div>
        </details>

        {autoReserve.reasons.length > 0 && (
          <div className="mt-3 space-y-1 rounded-2xl border border-hold/30 bg-hold-bg p-4 text-[13px]">
            {autoReserve.reasons.map((r) => (
              <p key={r.payDate} className="text-hold">
                Pay date {formatShortDateLabel(r.payDate)} is short {formatMoney(r.shortfall)}
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
            <button type="submit" className={BTN_SOLID}>
              Mark {formatShortDateLabel(window.payDate)} posted
            </button>
          </form>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={CARD}>
          <p className="text-[12.5px] text-ink-2">Net worth</p>
          <Money value={netWorthSummary.total} size="stat" />
          {netWorthSummary.growthPct != null && (
            <p className={`mt-1 text-[12.5px] ${netWorthSummary.growthPct >= 0 ? "text-good" : "text-bad"}`}>
              {netWorthSummary.growthPct >= 0 ? "▲" : "▼"} {Math.abs(netWorthSummary.growthPct).toFixed(1)}%
            </p>
          )}
        </div>
        <div className={CARD}>
          <p className="flex items-center gap-1 text-[12.5px] text-ink-2">
            Rollover in
            <Tooltip text="Whatever was left over from your last pay period, carried into this one." />
          </p>
          <Money value={rollover} size="stat" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Where it goes</h2>
        {spendingByCategory.length === 0 ? (
          <EmptyState emoji="🍃" title="Nothing spent yet this period" />
        ) : (
          <SpendingRing data={spendingByCategory} />
        )}
      </section>

      <section>
        <h2 className="mb-1 font-display text-[22px] font-medium text-ink">Net worth over time</h2>
        <NetWorthLines points={netWorthSummary.history} variant="full" />
        {netWorthSummary.history.length > 1 && (
          <p className="mt-2 text-[12.5px] text-ink-3">
            The gap between the lines is real growth — not just money you added.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">
          Earmarked this period{" "}
          <Link href="/recurring" className={`${LINK_QUIET} ml-1`}>
            Manage →
          </Link>
        </h2>
        {earmarkedItems.length === 0 ? (
          <EmptyState emoji="🧾" title="Nothing earmarked this period" />
        ) : (
          <div className="space-y-1.5">
            {earmarkedItems
              .slice()
              .sort((a, b) => a.occDate.localeCompare(b.occDate))
              .map((o) => (
                <div
                  key={`${o.item.id}|${o.occDate}`}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-[13.5px] ${o.skipped ? "opacity-50" : ""}`}
                >
                  <span className="text-ink-2">
                    {o.item.name} <span className="text-ink-3">· {formatShortDateLabel(o.occDate)}</span>
                  </span>
                  <span className={o.posted ? "text-good" : "text-ink"}>
                    {formatMoney(o.amount)}
                    {o.skipped && " (skipped)"}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Purchases</h2>
        <form action={createPurchase} className="mb-4 flex flex-wrap items-end gap-3">
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
              className={INPUT}
            />
          </label>
          <label className={LABEL}>
            Category
            <input name="category" defaultValue="Play" className={`w-28 ${INPUT}`} />
          </label>
          <button type="submit" className={BTN_SOLID}>
            Log a purchase
          </button>
        </form>

        {purchases.length === 0 ? (
          <EmptyState emoji="🧋" title="Nothing logged this period yet" />
        ) : (
          <div className="space-y-1.5">
            {purchases.map((p) => (
              <div key={p.id} className={`${ROW} flex items-center justify-between`}>
                <span className="text-[13.5px] text-ink">
                  {p.name}{" "}
                  <span className="text-ink-3">
                    · {formatShortDateLabel(p.spent_on)} · {p.category}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[13.5px] text-ink tabular-nums">{formatMoney(p.amount)}</span>
                  <form action={deletePurchase}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className={LINK_QUIET}>
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Ask Moss</h2>
        {settings.gemini_key_set ? (
          <AdvisorPanel />
        ) : (
          <EmptyState
            emoji="🌱"
            title="Connect a Gemini key to ask Moss questions"
            hint="Add one in Settings under Connections."
          />
        )}
      </section>
    </div>
  );
}
