import { closeElapsedPeriods } from "@/lib/data/close-periods";
import { listClosedPayPeriods } from "@/lib/data/history";
import { formatDateRange, formatMoney, formatShortDateLabel } from "@/lib/format";
import { Money } from "@/components/Money";
import { EmptyState } from "@/components/EmptyState";
import { ROW } from "@/lib/ui";

interface Snapshot {
  earmarked: { name: string; occDate: string; amount: number }[];
  purchases: { name: string; amount: number; spent_on: string; category: string }[];
}

export default async function HistoryPage() {
  await closeElapsedPeriods();
  const periods = await listClosedPayPeriods();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">History</h1>
        <p className="mt-1 text-[13px] text-ink-2">Closed pay periods, frozen as they were.</p>
      </div>

      {periods.length === 0 ? (
        <EmptyState
          emoji="📬"
          title="No closed pay periods yet"
          hint="Your first will appear here after a window ends."
        />
      ) : (
        <div className="space-y-2">
          {periods.map((p) => {
            const snapshot = p.snapshot as unknown as Snapshot | null;
            return (
              <div key={p.id} className={ROW}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] text-ink">{formatDateRange(p.window_start, p.window_end)}</p>
                    <p className="text-[12px] text-ink-3">Paid {formatShortDateLabel(p.pay_date)}</p>
                  </div>
                  <Money value={p.safe_to_spend ?? 0} size="card" />
                </div>

                {snapshot && (snapshot.earmarked.length > 0 || snapshot.purchases.length > 0) && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink-2">
                      What happened this period
                    </summary>
                    <div className="mt-2 space-y-3 text-[13px]">
                      {snapshot.earmarked.length > 0 && (
                        <div>
                          <p className="text-[11.5px] uppercase tracking-wide text-ink-3">Earmarked</p>
                          {snapshot.earmarked.map((e, i) => (
                            <div key={i} className="flex justify-between py-0.5 text-ink-2">
                              <span>
                                {e.name} <span className="text-ink-3">· {formatShortDateLabel(e.occDate)}</span>
                              </span>
                              <span className="tabular-nums">{formatMoney(e.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {snapshot.purchases.length > 0 && (
                        <div>
                          <p className="text-[11.5px] uppercase tracking-wide text-ink-3">Purchases</p>
                          {snapshot.purchases.map((pu, i) => (
                            <div key={i} className="flex justify-between py-0.5 text-ink-2">
                              <span>
                                {pu.name} <span className="text-ink-3">· {pu.category}</span>
                              </span>
                              <span className="tabular-nums">{formatMoney(pu.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
