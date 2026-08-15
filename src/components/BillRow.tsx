import { formatMoney } from "@/lib/format";
import { StandardRow } from "@/components/StandardRow";
import { IconCircle } from "@/components/IconCircle";
import { CountdownBadge } from "@/components/CountdownBadge";
import { MarkPostedCheckbox } from "@/components/MarkPostedCheckbox";
import { RowMenu } from "@/components/RowMenu";
import { skipOccurrence, unskipOccurrence, editOccurrenceOnce } from "@/lib/actions/recurring";
import { BTN_SOLID, INPUT } from "@/lib/ui";
import type { ResolvedOccurrence } from "@/lib/recurring";

interface CategoryLike {
  name: string;
  emoji: string | null;
  color: string | null;
}

/**
 * Rev 05 §1.1/§5: the shared bill/earmark row — used identically on
 * Expenses' Current/Next pay period cards and Dashboard's "Earmarked this
 * period" card. A checkbox handles mark-posted directly (not buried in the
 * `⋯` menu); the menu still covers edit-once and skip.
 */
export function BillRow({ occurrence, todayISO, category }: { occurrence: ResolvedOccurrence; todayISO: string; category: CategoryLike | null }) {
  const o = occurrence;
  return (
    <div className="flex items-center gap-2.5 py-1">
      <MarkPostedCheckbox
        recurringItemId={o.item.id}
        occDate={o.occDate}
        isVariable={o.item.is_variable}
        estimatedAmount={o.amount}
        posted={o.posted}
      />
      <div className="flex-1 min-w-0">
        <StandardRow
          leadingIcon={<IconCircle value={o.item.icon} label={o.item.name} variant="solid" />}
          name={o.item.name}
          subtitle={<CountdownBadge dateISO={o.occDate} todayISO={todayISO} />}
          categorySymbol={
            category ? <IconCircle value={category.emoji} label={category.name} color={category.color} variant="tinted" size="sm" /> : null
          }
          estBadge={o.isEstimate && !o.skipped}
          amountNode={<span className="text-ink">{formatMoney(o.amount)}</span>}
          dimmed={o.skipped}
          trailing={
            <RowMenu
              popovers={[
                {
                  label: "Edit once",
                  content: (
                    <form action={editOccurrenceOnce} className="flex items-center gap-2">
                      <input type="hidden" name="recurring_item_id" value={o.item.id} />
                      <input type="hidden" name="occ_date" value={o.occDate} />
                      <input type="number" step="0.01" name="override_amount" defaultValue={o.amount} className={`flex-1 ${INPUT}`} />
                      <button type="submit" className={BTN_SOLID}>
                        Save
                      </button>
                    </form>
                  ),
                },
              ]}
            >
              {o.skipped ? (
                <form action={unskipOccurrence}>
                  <input type="hidden" name="recurring_item_id" value={o.item.id} />
                  <input type="hidden" name="occ_date" value={o.occDate} />
                  <button type="submit">Unskip</button>
                </form>
              ) : (
                <form action={skipOccurrence}>
                  <input type="hidden" name="recurring_item_id" value={o.item.id} />
                  <input type="hidden" name="occ_date" value={o.occDate} />
                  <button type="submit">Skip</button>
                </form>
              )}
            </RowMenu>
          }
        />
      </div>
    </div>
  );
}
