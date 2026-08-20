import Link from "next/link";
import { Lock } from "lucide-react";
import { getTodaySnapshot } from "@/lib/data/today";
import { getTodayExtras } from "@/lib/data/today-extras";
import { getSettings } from "@/lib/data/settings";
import { listCategories } from "@/lib/data/recurring";
import { lucideKey } from "@/lib/icons";
import { postPaycheck } from "@/lib/actions/income";
import { seedDemoData } from "@/lib/actions/demo";
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
import { CurrentPeriodCard } from "@/components/CurrentPeriodCard";
import { Greeting } from "@/components/Greeting";
import { BTN_MOSS, BTN_SOLID, CARD, CARD_HEADER, LINK_QUIET, PILL_HOLD, SCROLL_LIST } from "@/lib/ui";

export default async function TodayPage() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [snap, settings, categories] = await Promise.all([getTodaySnapshot(), getSettings(), listCategories()]);
  const extras = await getTodayExtras(todayISO);
  const { netWorth, historyPoints, indices, recentGroups, upcomingWeek } = extras;
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  if (!snap.hasPrimaryIncome) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={lucideKey("wallet")}
          title="Add an income source to see Safe to spend"
          hint="Head to Income to get started."
        />
        {settings.demo_seeded && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-[12.5px] text-ink-3">
              Had demo data before? Something may have cleared it.
            </p>
            <form action={seedDemoData}>
              <button type="submit" className={BTN_SOLID}>
                Reload demo data
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (!snap.window) {
    return (
      <EmptyState
        icon={lucideKey("calendar")}
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
        <p className="text-[26px] font-medium leading-tight text-ink">
          <Greeting />
        </p>
        <p className="mt-0.5 text-[15px] text-ink-2">{formatDateRange(window.start, window.end)}</p>
      </div>

      {/* Rev 09 §5.1/Rev 10 §3.2: Alerts cut another ~33% narrower (2.7fr
          → 4.5fr on the graph's side, same 1fr Alerts column, works out to
          an Alerts column ~33% narrower than Rev 09's ratio), graph widens
          to fill the freed space. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[4.5fr_1fr]">
        <NetWorthHero total={netWorth.total} points={historyPoints} />
        <AlertsCard items={reviewItems} />
      </div>

      {/* Rev 10 §1.1: `flex flex-col` is load-bearing, not decorative — Money's
          root element is an inline <span>, and vertical margin on an inline
          box has no layout effect at all outside a flex/grid container. Without
          this, card-title-to-hero silently does nothing here (confirmed by
          measuring: 20px of incidental line-height spacing, not the real 16px
          token) even though NetWorthHero's identical class works, because
          that section already happens to be flex. */}
      <section className={`${CARD} flex flex-col`}>
        {/* Rev 10 §1.1: title in its own unsized wrapper — the paycheck
            button (+ its conditional early-pay subtext) is absolutely
            positioned so its variable height can never stretch the gap
            to the hero number below, which is what let this card's gap
            drift from Net worth's. */}
        <div className="card-title-row">
          <p className={CARD_HEADER}>Safe to spend</p>
          {!snap.alreadyPosted && (
            <div className="absolute right-0 top-0 text-right">
              <form action={postPaycheck}>
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
                  <p className="mt-1.5 flex items-center justify-end gap-1 text-[11.5px] text-ink-3">
                    Bank shows it {formatShortDateLabel(expected)}
                    <Tooltip text="Based on your early-pay and business-day settings — the pay-period window itself still runs off the official payday." />
                  </p>
                ) : null;
              })()}
            </div>
          )}
        </div>
        <Money value={safeToSpend} size="section" className="card-title-to-hero text-moss" />

        <div className="ml-[29px] mt-3 inline-flex items-center gap-1.5 rounded-full bg-moss-bg px-3 py-1.5 text-[13px] font-medium text-moss">
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
          <div className={`mt-3 flex items-center gap-1.5 ${PILL_HOLD}`}>
            <Lock size={13} strokeWidth={2} />
            Holding {formatMoney(autoReserve.reserve)} for next paycheck
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
              <span className="text-ink-2">− Earmarked</span>
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

      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${CARD} flex h-full flex-col`}>
          <p className={CARD_HEADER}>
            Recent transactions{" "}
            <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
              See all →
            </Link>
          </p>
          <div className={`card-title-to-hero ${SCROLL_LIST}`}>
            {recentGroups.length === 0 ? (
              <p className="text-[13px] text-ink-3">Nothing logged recently.</p>
            ) : (
              <RecentList groups={recentGroups} />
            )}
          </div>
        </section>

        <section className={`${CARD} flex h-full flex-col`}>
          <p className={CARD_HEADER}>
            Upcoming{" "}
            <Link href="/expenses" className={`${LINK_QUIET} ml-1`}>
              See all →
            </Link>
          </p>
          <div className="card-title-to-hero flex-1">
            <UpcomingStrip days={upcomingWeek} />
          </div>
        </section>

        <CurrentPeriodCard
          title="Earmarked this period"
          window={window}
          occurrences={earmarkedItems.slice().sort((a, b) => a.occDate.localeCompare(b.occDate))}
          categoryById={categoryById}
          todayISO={todayISO}
          emptyLabel="Nothing earmarked this period."
        />
      </div>
    </div>
  );
}
