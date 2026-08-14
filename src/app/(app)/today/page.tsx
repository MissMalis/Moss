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
import { AlertsCard } from "@/components/AlertsCard";
import { RecentList } from "@/components/RecentList";
import { UpcomingStrip } from "@/components/UpcomingStrip";
import { BTN_MOSS, CARD, CARD_HEADER, LINK_QUIET, PILL_HOLD, SCROLL_LIST } from "@/lib/ui";

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
  const { netWorth, historyPoints, indices, recentGroups, upcomingWeek } = extras;

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
    <div className="space-y-6">
      <TickerBar indices={indices} />

      <div>
        <p className="text-[20px] text-ink">{greeting()}</p>
        <p className="text-[14px] text-ink-2">{formatDateRange(window.start, window.end)}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <NetWorthHero total={netWorth.total} points={historyPoints} />
        <AlertsCard items={reviewItems} />
      </div>

      <section className={CARD}>
        <p className={CARD_HEADER}>Safe to spend</p>
        <Money value={safeToSpend} size="hero" className="text-moss" />

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-moss-bg px-3 py-1.5 text-[13px] font-medium text-moss">
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
          <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-card-soft p-4 text-[14px]">
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
              <button type="submit" className={BTN_MOSS}>
                Confirm {formatShortDateLabel(window.payDate)} paycheck
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${CARD} flex h-full flex-col`}>
          <p className={CARD_HEADER}>
            Recent transactions{" "}
            <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
              See all →
            </Link>
          </p>
          {recentGroups.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">Nothing logged recently.</p>
          ) : (
            <div className={`mt-3 flex-1 ${SCROLL_LIST}`}>
              <RecentList groups={recentGroups} />
            </div>
          )}
        </section>

        <section className={`${CARD} flex h-full flex-col`}>
          <p className={CARD_HEADER}>
            Upcoming{" "}
            <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
              See all →
            </Link>
          </p>
          <div className="mt-3 flex-1">
            <UpcomingStrip days={upcomingWeek} />
          </div>
        </section>

        <section className={`${CARD} flex h-full flex-col`}>
          <p className={CARD_HEADER}>
            Earmarked this period{" "}
            <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
              Manage →
            </Link>
          </p>
          {earmarkedItems.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-3">Nothing earmarked this period.</p>
          ) : (
            <div className={`mt-3 flex-1 space-y-1 ${SCROLL_LIST}`}>
              {earmarkedItems
                .slice()
                .sort((a, b) => a.occDate.localeCompare(b.occDate))
                .map((o) => (
                  <div
                    key={`${o.item.id}|${o.occDate}`}
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] ${o.skipped ? "opacity-50" : ""}`}
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
      </div>
    </div>
  );
}
