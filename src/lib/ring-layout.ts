// Segmented-donut geometry with reserved gap space, so gaps are structural
// (always present, always equal) rather than leftover space that shrinks to
// nothing when one category dominates.

export interface RingValue {
  name: string;
  value: number;
}

export interface RingSegmentLayout extends RingValue {
  length: number; // arc length, same units as circumference
  offset: number; // cumulative offset before this segment
}

export const GAP_DEG = 14;

export function computeRingLayout(
  values: RingValue[],
  circumference: number,
  gapDeg: number = GAP_DEG,
): RingSegmentLayout[] {
  const n = values.length;
  if (n === 0) return [];

  const gapLen = circumference * (gapDeg / 360);
  const available = Math.max(0, circumference - n * gapLen);
  const total = values.reduce((s, v) => s + v.value, 0);

  let offset = 0;
  const out: RingSegmentLayout[] = [];
  for (const v of values) {
    const length = total > 0 ? available * (v.value / total) : 0;
    out.push({ ...v, length, offset });
    offset += length + gapLen;
  }
  return out;
}
