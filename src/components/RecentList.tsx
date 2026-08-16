import { formatMoney, formatShortDateLabel } from "@/lib/format";
import { StandardRow } from "@/components/StandardRow";
import { IconCircle } from "@/components/IconCircle";
import type { DateGroup } from "@/lib/recent-transactions";

/**
 * Rev 05 §1.1/§1.12: the ONE shared recent-transactions row, used on
 * Dashboard, Expenses, and Sweep — greyed date-block headers, the standard
 * grid row underneath (no per-row date).
 */
export function RecentList({
  groups,
  onRemoveAction,
}: {
  groups: DateGroup[];
  /** Optional server action wired to a "Remove" link per row (Expenses' Log an expense). */
  onRemoveAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date}>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-3">
            {formatShortDateLabel(group.date)}
          </p>
          <div className="divide-y divide-border">
            {group.items.map((t) => (
              <StandardRow
                key={t.id}
                leadingIcon={
                  <IconCircle
                    value={null}
                    label={t.name}
                    color={t.kind === "income" ? "var(--color-good)" : t.kind === "transfer" ? "#9aa2ab" : undefined}
                    variant="solid"
                  />
                }
                name={t.name}
                categorySymbol={
                  t.kind === "outflow" ? (
                    <IconCircle value={t.categoryIcon ?? null} label={t.category ?? t.name} color={t.categoryColor} variant="tinted" size="sm" />
                  ) : null
                }
                amountNode={
                  <span className={t.kind === "income" ? "text-good" : t.kind === "transfer" ? "text-ink-3" : "text-ink"}>
                    {t.kind === "income" ? "+" : t.kind === "transfer" ? "" : "−"}
                    {formatMoney(t.amount)}
                  </span>
                }
                trailing={
                  onRemoveAction && t.kind === "outflow" ? (
                    <form action={onRemoveAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="text-[12px] text-ink-3 transition hover:text-bad">
                        Remove
                      </button>
                    </form>
                  ) : null
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
