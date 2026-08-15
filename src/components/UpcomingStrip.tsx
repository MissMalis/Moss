import { formatMoney } from "@/lib/format";
import type { DayColumn } from "@/lib/upcoming-week";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Today §2.6 "Upcoming": a Mon–Sun strip, each day a column of category-colored initial circles + a per-day total. */
export function UpcomingStrip({ days }: { days: DayColumn[] }) {
  return (
    <div className="grid h-full grid-cols-7 gap-1.5">
      {days.map((day, i) => {
        const dayNum = Number(day.date.slice(8, 10));
        return (
          <div
            key={day.date}
            className={`flex min-h-[240px] flex-col items-center gap-1.5 rounded-lg px-1 py-2 ${day.isToday ? "bg-moss-bg" : ""}`}
          >
            <p className={`text-[10.5px] uppercase tracking-wide ${day.isToday ? "text-moss" : "text-ink-3"}`}>
              {WEEKDAY_LABELS[i]}
            </p>
            <p className={`text-[12.5px] tabular-nums ${day.isToday ? "font-medium text-moss" : "text-ink-2"}`}>
              {dayNum}
            </p>
            <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-1">
              {day.items.map((item) => (
                <span
                  key={item.id}
                  title={`${item.name} · ${formatMoney(item.amount)}`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-bg"
                  style={{ background: item.categoryColor }}
                >
                  {item.categoryInitial}
                </span>
              ))}
            </div>
            {day.total > 0 && (
              <div className="mt-auto w-full shrink-0 rounded-md bg-card-soft px-1 py-1 text-center text-[10.5px] tabular-nums text-ink-2">
                {formatMoney(day.total)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
