import { listClosedPayPeriods } from "@/lib/data/history";
import { formatDateRange } from "@/lib/format";
import { Money } from "@/components/Money";
import { EmptyState } from "@/components/EmptyState";
import { ROW } from "@/lib/ui";

export default async function HistoryPage() {
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
          {periods.map((p) => (
            <div key={p.id} className={`${ROW} flex items-center justify-between`}>
              <span className="text-[14px] text-ink">
                {formatDateRange(p.window_start, p.window_end)}
              </span>
              <Money value={p.safe_to_spend ?? 0} size="card" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
