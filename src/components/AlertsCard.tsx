import Link from "next/link";
import { dismissAlert } from "@/lib/actions/alerts";
import type { ReviewItem } from "@/lib/checklist";
import { CARD, CARD_HEADER, SCROLL_LIST } from "@/lib/ui";

/**
 * Rev 04 §2.3: renamed from "Needs review". Each row is checkable (mark
 * done — dismisses it) and clickable (jumps to where it points). Height-
 * matched to the net worth card via the parent grid, scrollable inside.
 */
export function AlertsCard({ items }: { items: ReviewItem[] }) {
  return (
    <div className={`${CARD} flex h-full flex-col`}>
      <p className={CARD_HEADER}>Alerts</p>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">Nothing needs a look right now.</p>
      ) : (
        <div className={`mt-3 flex-1 ${SCROLL_LIST}`}>
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 border-b border-border py-2 last:border-0">
              <form action={dismissAlert}>
                <input type="hidden" name="alert_id" value={item.id} />
                <button
                  type="submit"
                  aria-label="Mark done"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong text-[10px] text-transparent transition hover:border-moss hover:text-moss"
                >
                  ✓
                </button>
              </form>
              <Link
                href={item.href}
                className="flex flex-1 items-center justify-between gap-2 text-[13px] text-ink transition hover:text-moss"
              >
                <span>{item.message}</span>
                <span className="shrink-0 text-ink-3" aria-hidden>
                  ›
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
