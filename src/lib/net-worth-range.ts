import type { HistoryPoint } from "@/lib/net-worth";

// Today §2.3: the hero graph's range selector + the two deltas under the
// headline number.

export type RangeKey = "3M" | "6M" | "1Y" | "ALL";

const RANGE_DAYS: Record<Exclude<RangeKey, "ALL">, number> = {
  "3M": 92,
  "6M": 183,
  "1Y": 366,
};

export function filterByRange(points: HistoryPoint[], range: RangeKey): HistoryPoint[] {
  if (range === "ALL" || points.length === 0) return points;
  const lastDate = new Date(points[points.length - 1].date + "T00:00:00");
  const cutoff = new Date(lastDate);
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  return points.filter((p) => p.date >= cutoffISO);
}

export interface NetWorthDelta {
  /** Market-value move within just the selected range, as a dollar amount. */
  rangeAbs: number;
  /** That same move as a percentage of the range's starting value. */
  rangePct: number;
}

/**
 * Rev 09 §2.4: a single delta — both the $ and % move within the
 * currently selected range (3M/6M/1Y/ALL), sharing one sign/color/arrow.
 * No all-time figure, no date suffix — those were dropped in the graph
 * rebuild in favor of one number that updates with the timeframe toggle.
 */
export function computeDeltas(allPoints: HistoryPoint[], rangePoints: HistoryPoint[]): NetWorthDelta | null {
  if (allPoints.length === 0 || rangePoints.length === 0) return null;
  const rangeFirst = rangePoints[0];
  const rangeLast = rangePoints[rangePoints.length - 1];
  const rangeAbs = rangeLast.marketValue - rangeFirst.marketValue;
  const rangePct = rangeFirst.marketValue > 0 ? (rangeAbs / rangeFirst.marketValue) * 100 : 0;
  return { rangeAbs, rangePct };
}
