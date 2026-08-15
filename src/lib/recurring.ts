import { occurrenceInWindow } from "@/lib/periods";

export interface RecurringItemLike {
  id: string;
  name: string;
  amount: number;
  is_variable: boolean;
  day_of_month: number;
  active: boolean;
  category_id: string | null;
  icon?: string | null;
}

export interface OccurrenceStateLike {
  skipped: boolean;
  override_amount: number | null;
  posted: boolean;
  actual_amount: number | null;
}

export interface ResolvedOccurrence {
  item: RecurringItemLike;
  occDate: string;
  amount: number; // what counts toward earmarked (estimate pre-post, actual post-post, unless overridden)
  isEstimate: boolean;
  skipped: boolean;
  posted: boolean;
  overridden: boolean;
}

/**
 * Expand active recurring items into their occurrence(s) within [start, end],
 * resolving each against its stored per-occurrence state (skip/override/post).
 * `occurrenceState` is keyed by `${itemId}|${occDate}`.
 */
export function buildOccurrencesForWindow(
  items: RecurringItemLike[],
  occurrenceState: Map<string, OccurrenceStateLike>,
  start: string,
  end: string,
): ResolvedOccurrence[] {
  const out: ResolvedOccurrence[] = [];

  for (const item of items) {
    if (!item.active) continue;
    const occDate = occurrenceInWindow({ day: item.day_of_month }, start, end);
    if (!occDate) continue;

    const state = occurrenceState.get(`${item.id}|${occDate}`);
    const skipped = state?.skipped ?? false;
    const posted = state?.posted ?? false;
    const overridden = state?.override_amount != null;

    let amount: number;
    let isEstimate: boolean;
    if (overridden) {
      amount = state!.override_amount!;
      isEstimate = !posted;
    } else if (posted && state?.actual_amount != null) {
      amount = state.actual_amount;
      isEstimate = false;
    } else {
      amount = item.amount;
      isEstimate = true;
    }

    out.push({ item, occDate, amount, isEstimate, skipped, posted, overridden });
  }

  return out;
}

/** Total that reduces Safe to Spend: skipped occurrences don't count. */
export function sumEarmarked(occurrences: ResolvedOccurrence[]): number {
  return occurrences.reduce((sum, o) => (o.skipped ? sum : sum + o.amount), 0);
}

/**
 * Variable-bill estimate seed: rolling average of the last up to 3 actuals,
 * most-recent first. Returns null if there's no history yet (caller should
 * keep the existing manual default in that case).
 */
export function rollingAverage(actualsMostRecentFirst: number[]): number | null {
  const sample = actualsMostRecentFirst.slice(0, 3);
  if (sample.length === 0) return null;
  const sum = sample.reduce((a, b) => a + b, 0);
  return Math.round((sum / sample.length) * 100) / 100;
}
