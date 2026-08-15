import { formatDateRange } from "@/lib/format";
import { sumEarmarked, type ResolvedOccurrence } from "@/lib/recurring";
import { BillRow } from "@/components/BillRow";
import { Money } from "@/components/Money";
import type { PayWindow } from "@/lib/periods";
import { CARD, CARD_HEADER, SCROLL_LIST } from "@/lib/ui";

interface CategoryLike {
  name: string;
  emoji: string | null;
  color: string | null;
}

/**
 * Rev 05 §3.5/§5: the "Current pay period" card on Expenses, reused
 * verbatim (same layout, same rows) as Dashboard's "Earmarked this
 * period" card — one component, two titles. Total sits top-right.
 */
export function CurrentPeriodCard({
  title,
  window,
  occurrences,
  categoryById,
  todayISO,
  emptyLabel,
}: {
  title: string;
  window: PayWindow | null;
  occurrences: ResolvedOccurrence[];
  categoryById: Map<string, CategoryLike>;
  todayISO: string;
  emptyLabel: string;
}) {
  const total = sumEarmarked(occurrences);

  return (
    <div className={`${CARD} flex h-full flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={CARD_HEADER}>{title}</p>
          {window && <p className="mt-0.5 text-[12px] text-ink-3">{formatDateRange(window.start, window.end)}</p>}
        </div>
        <Money value={total} size="card" />
      </div>
      {occurrences.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">{emptyLabel}</p>
      ) : (
        <div className={`mt-2 flex-1 divide-y divide-border ${SCROLL_LIST}`}>
          {occurrences.map((o) => (
            <BillRow
              key={`${o.item.id}|${o.occDate}`}
              occurrence={o}
              todayISO={todayISO}
              category={o.item.category_id ? (categoryById.get(o.item.category_id) ?? null) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
