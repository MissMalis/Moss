import { smoothAreaPath, smoothBandPath, smoothLinePath, type Point } from "@/lib/svg-path";
import { formatMonthLabel } from "@/lib/format";
import type { HistoryPoint } from "@/lib/net-worth";

interface Props {
  points: HistoryPoint[];
  variant?: "spark" | "full";
}

function scale(points: HistoryPoint[], width: number, height: number, padLeft: number, padBottom: number) {
  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.contributed, p.marketValue)));
  const innerW = width - padLeft;
  const innerH = height - padBottom;
  const x = (i: number) =>
    points.length <= 1 ? padLeft + innerW / 2 : padLeft + (i / (points.length - 1)) * innerW;
  const y = (v: number) => innerH - (v / maxVal) * innerH;
  return { x, y, maxVal, innerH };
}

export function NetWorthLines({ points, variant = "full" }: Props) {
  if (points.length === 0) {
    return variant === "spark" ? (
      <div className="flex h-[52px] w-[110px] items-center justify-center text-[11px] text-ink-3">
        no history yet
      </div>
    ) : (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-ink-3">
        Growth will show up here once a few days of history build up.
      </div>
    );
  }

  if (variant === "spark") {
    const width = 110;
    const height = 52;
    const { x, y } = scale(points, width, height, 0, 0);
    const marketPts: Point[] = points.map((p, i) => [x(i), y(p.marketValue)]);
    const contribPts: Point[] = points.map((p, i) => [x(i), y(p.contributed)]);
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={smoothLinePath(contribPts)} fill="none" stroke="var(--color-contributed)" strokeWidth={1.5} strokeDasharray="3 3" />
        <path d={smoothLinePath(marketPts)} fill="none" stroke="var(--color-good)" strokeWidth={2} />
      </svg>
    );
  }

  const width = 640;
  const height = 220;
  const padLeft = 44;
  const padBottom = 24;
  const { x, y, maxVal, innerH } = scale(points, width, height, padLeft, padBottom);

  const marketPts: Point[] = points.map((p, i) => [x(i), y(p.marketValue)]);
  const contribPts: Point[] = points.map((p, i) => [x(i), y(p.contributed)]);
  const baselineY = innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((maxVal * f) / 1000));

  // Label roughly 4-6 evenly spaced points along the x-axis by month,
  // collapsing repeats so a short history doesn't print "Jan Jan Jan".
  const labelCount = Math.min(6, points.length);
  const rawLabelIdx = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i / Math.max(1, labelCount - 1)) * (points.length - 1)),
  );
  const seenMonths = new Set<string>();
  const labelIdx = rawLabelIdx.filter((i) => {
    const label = formatMonthLabel(points[i].date);
    if (seenMonths.has(label)) return false;
    seenMonths.add(label);
    return true;
  });

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {ticks.map((t, i) => (
        <text
          key={i}
          x={0}
          y={y(t * 1000) + 4}
          style={{ fontSize: 11, fill: "var(--color-ink-3)", fontFamily: "var(--font-inter)" }}
        >
          ${t}k
        </text>
      ))}

      <path
        d={smoothAreaPath(contribPts, baselineY)}
        fill="var(--color-contributed)"
        opacity={0.1}
        stroke="none"
      />
      <path d={smoothBandPath(marketPts, contribPts)} fill="var(--color-good)" opacity={0.13} stroke="none" />

      <path
        d={smoothLinePath(contribPts)}
        fill="none"
        stroke="var(--color-contributed)"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      <path d={smoothLinePath(marketPts)} fill="none" stroke="var(--color-good)" strokeWidth={2} />

      {labelIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={height - 4}
          textAnchor="middle"
          style={{ fontSize: 11, fill: "var(--color-ink-3)", fontFamily: "var(--font-inter)" }}
        >
          {formatMonthLabel(points[i].date)}
        </text>
      ))}
    </svg>
  );
}
