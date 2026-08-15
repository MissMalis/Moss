import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { dismissAlert } from "@/lib/actions/alerts";
import { IconCircle } from "@/components/IconCircle";
import type { ReviewItem } from "@/lib/checklist";
import { CARD, CARD_HEADER, SCROLL_LIST } from "@/lib/ui";

/**
 * Rev 05 §3: renamed from "Needs review". Each row: a checkbox (mark done —
 * dismisses it), the per-type icon, two lines of text (line 1 = the task,
 * line 2 = the detail — no em-dash joining them into one line), and a
 * chevron that jumps to the target. Height-matched to the net worth card,
 * scrollable inside.
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
            <div key={item.id} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-0">
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
              <IconCircle value={item.icon} label={item.actionLabel} variant="tinted" size="sm" />
              <Link href={item.href} className="flex flex-1 items-center justify-between gap-2 group min-w-0">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink transition group-hover:text-moss">{item.actionLabel}</p>
                  <p className="truncate text-[12px] text-ink-2">{item.message}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-ink-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
