import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { candyColorForCategory } from "@/lib/candy-colors";
import type { DateGroup } from "@/lib/recent-transactions";

/** Today §2.6 "Recent": greyed date headers, rows with no per-row date — a category dot + name, amount on the right. */
export function RecentList({ groups }: { groups: DateGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date}>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-3">
            {formatShortDateLabel(group.date)}
          </p>
          <div className="space-y-1">
            {group.items.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-[13.5px] text-ink">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: t.kind === "income" ? "var(--color-good)" : candyColorForCategory(t.category ?? t.name) }}
                  />
                  {t.name}
                </span>
                <span className={`tabular-nums text-[13.5px] ${t.kind === "income" ? "text-good" : "text-ink"}`}>
                  {t.kind === "income" ? "+" : "−"}
                  {formatMoney(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
