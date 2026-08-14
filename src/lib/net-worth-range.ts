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
  allTimePct: number;
  rangeAbs: number;
  rangeDate: string;
}

/**
 * `allTimePct` is growth-over-contribution across the whole history
 * (independent of the selected range); `rangeAbs`/`rangeDate` describe the
 * move within just the selected range, so the second delta line updates as
 * the range selector changes while the first one doesn't.
 */
export function computeDeltas(allPoints: HistoryPoint[], rangePoints: HistoryPoint[]): NetWorthDelta | null {
  if (allPoints.length === 0) return null;
  const last = allPoints[allPoints.length - 1];
  const allTimeGrowth = last.marketValue - last.contributed;
  const allTimePct = last.contributed > 0 ? (allTimeGrowth / last.contributed) * 100 : 0;

  if (rangePoints.length === 0) {
    return { allTimePct, rangeAbs: 0, rangeDate: last.date };
  }
  const rangeFirst = rangePoints[0];
  const rangeLast = rangePoints[rangePoints.length - 1];
  return { allTimePct, rangeAbs: rangeLast.marketValue - rangeFirst.marketValue, rangeDate: rangeLast.date };
}
