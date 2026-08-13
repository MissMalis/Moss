export type Point = [number, number];

/** Catmull-Rom -> cubic Bezier smoothing, so lines read as curves, not connect-the-dots. */
export function smoothLinePath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Same smoothed line, closed down to `baselineY` for an area fill. */
export function smoothAreaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const line = smoothLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last[0]} ${baselineY} L ${first[0]} ${baselineY} Z`;
}

/** Band between two smoothed lines (e.g. market value above, contributed below). */
export function smoothBandPath(topPoints: Point[], bottomPoints: Point[]): string {
  if (topPoints.length === 0 || bottomPoints.length === 0) return "";
  const top = smoothLinePath(topPoints);
  const bottomReversed = [...bottomPoints].reverse();
  const bottom = smoothLinePath(bottomReversed).replace(/^M/, "L");
  return `${top} ${bottom} Z`;
}
