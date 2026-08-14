import Link from "next/link";
import { getTodaySnapshot } from "@/lib/data/today";
import { getTodayExtras } from "@/lib/data/today-extras";
import { getSettings } from "@/lib/data/settings";
import { postPaycheck } from "@/lib/actions/income";
import { expectedPayDate } from "@/lib/periods";
import { daysUntil, dollarsPerDay } from "@/lib/spend-pace";
import { formatDateRange, formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { Tooltip } from "@/components/Tooltip";
import { EmptyState } from "@/components/EmptyState";
import { TickerBar } from "@/components/TickerBar";
import { NetWorthHero } from "@/components/NetWorthHero";
import { RecentList } from "@/components/RecentList";
import { UpcomingStrip } from "@/components/UpcomingStrip";
import { BTN_SOLID, CARD, LINK_QUIET, PILL_HOLD } from "@/lib/ui";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [snap, settings] = await Promise.all([getTodaySnapshot(), getSettings()]);
  const extras = await getTodayExtras(todayISO);
  const { netWorth, assetsCount, liabilitiesCount, historyPoints, indices, recentGroups, upcomingWeek } = extras;

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

  const {
    window,
    income,
    rollover,
    earmarked,
    autoReserve,
    purchasesTotal,
    safeToSpend,
    earmarkedItems,
    reviewItems,
  } = snap;

  const daysLeft = daysUntil(todayISO, window.end);
  const perDay = dollarsPerDay(safeToSpend, daysLeft);
  const periodBudget = safeToSpend + purchasesTotal;
  const spentPct = periodBudget > 0 ? Math.min(100, (purchasesTotal / periodBudget) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[13px] text-ink-2">{greeting()}</p>
        <p className="text-[12.5px] text-ink-3">{formatDateRange(window.start, window.end)}</p>
      </div>

      <TickerBar indices={indices} />

      {reviewItems.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-[22px] font-medium text-ink">Needs review</h2>
          <div className="space-y-1.5">
            {reviewItems.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="flex items-center justify-between rounded-lg border border-hold/30 bg-hold-bg px-3 py-2 text-[13.5px] text-ink hover:border-hold/50"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>{r.emoji}</span>
                  {r.message}
                </span>
                <span className="text-hold">{r.actionLabel} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={CARD}>
          <p className="text-[12.5px] text-ink-2">Assets</p>
          <Money value={netWorth.byType && Object.entries(netWorth.byType).filter(([t]) => t !== "Liabilities").reduce((s, [, v]) => s + v, 0)} size="stat" />
          <p className="mt-1 text-[12px] text-ink-3">
            {assetsCount} account{assetsCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className={CARD}>
          <p className="text-[12.5px] text-ink-2">Liabilities</p>
          <Money value={Math.abs(netWorth.byType?.["Liabilities"] ?? 0)} size="stat" />
          <p className="mt-1 text-[12px] text-ink-3">
            {liabilitiesCount} debt{liabilitiesCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <NetWorthHero total={netWorth.total} points={historyPoints} />

      <section>
        <p className="text-[13px] text-ink-2">💸 Safe to spend</p>
        <Money value={safeToSpend} size="hero" className="text-moss" />

        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-moss-bg px-3 py-1.5 text-[13px] font-medium text-moss`}>
          {formatMoney(perDay)}/day · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
        </div>

        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-soft">
            <div className="h-full rounded-full bg-moss" style={{ width: `${spentPct}%` }} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-3">
            {formatMoney(purchasesTotal)} spent of {formatMoney(periodBudget)} for this period
          </p>
        </div>

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
          <div className="mt-3 space-y-1 rounded-lg border border-hold/30 bg-hold-bg p-4 text-[13px]">
            {autoReserve.reasons.map((r) => (
              <p key={r.payDate} className="text-hold">
                Pay date {formatShortDateLabel(r.payDate)} is short {formatMoney(r.shortfall)}
              </p>
            ))}
          </div>
        )}

        {!snap.alreadyPosted && (
          <>
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
            {(() => {
              const expected = expectedPayDate(window.payDate, settings.early_pay_days, settings.biz_shift);
              return expected !== window.payDate ? (
                <p className="mt-2 flex items-center gap-1 text-[12.5px] text-ink-3">
                  Your bank will likely show it on {formatShortDateLabel(expected)}
                  <Tooltip text="Based on your early-pay and business-day settings — the pay-period window itself still runs off the official payday." />
                </p>
              ) : null;
            })()}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[22px] font-medium text-ink">
          Earmarked this period{" "}
          <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
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
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13.5px] ${o.skipped ? "opacity-50" : ""}`}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-[22px] font-medium text-ink">
            Recent{" "}
            <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
              See all →
            </Link>
          </h2>
          {recentGroups.length === 0 ? (
            <EmptyState emoji="🧾" title="Nothing logged recently" />
          ) : (
            <RecentList groups={recentGroups} />
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-[22px] font-medium text-ink">
            Upcoming{" "}
            <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
              See all →
            </Link>
          </h2>
          <UpcomingStrip days={upcomingWeek} />
        </section>
      </div>
    </div>
  );
}
