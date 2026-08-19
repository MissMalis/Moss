"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { smoothAreaPath, smoothBandPath, smoothLinePath, type Point } from "@/lib/svg-path";
import { formatMonthLabel, formatMoney, formatShortDateLabel } from "@/lib/format";
import type { HistoryPoint } from "@/lib/net-worth";

interface Props {
  points: HistoryPoint[];
  variant?: "spark" | "full";
}

function scale(points: HistoryPoint[], width: number, height: number, pad: { left: number; right: number; top: number; bottom: number }) {
  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.contributed, p.marketValue)));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) =>
    points.length <= 1 ? pad.left + innerW / 2 : pad.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => pad.top + innerH - (v / maxVal) * innerH;
  return { x, y, maxVal, top: pad.top, bottom: pad.top + innerH };
}

/** One tick per distinct calendar month present — the last (most recent) point in each month, so ticks land evenly and the final month is never dropped. */
function monthTickIndices(points: HistoryPoint[]): number[] {
  const byMonth = new Map<string, number>();
  points.forEach((p, i) => byMonth.set(p.date.slice(0, 7), i));
  return Array.from(byMonth.values()).sort((a, b) => a - b);
}

const FALLBACK_WIDTH = 640;
const HEIGHT = 220;
// Rev 09 §2.1: explicit margins between the card's inner edge and the
// plotted data — not edge to edge (that was an earlier over-correction).
const PAD = { left: 24, right: 24, top: 16, bottom: 28 };
const TOOLTIP_MARGIN = 8;

/**
 * Rev 05 §1.11/Rev 08 #3/Rev 09 §2: every graph fills its card and is
 * hoverable — a vertical guide + tooltip at the nearest point, clamped so
 * it never renders outside the container. One shared component for
 * Dashboard and Net worth (both render this via NetWorthHero).
 *
 * The viewBox's width is measured from the actual container, not a fixed
 * constant, so the plot scales 1:1 on both axes regardless of card width
 * (a non-uniform-scale approach here previously warped strokes/text).
 */
export function NetWorthLines({ points, variant = "full" }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(FALLBACK_WIDTH);
  const [tooltipOffset, setTooltipOffset] = useState({ left: 0, flip: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      if (w > 0) setMeasuredWidth(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pointXPx = (idx: number) => (idx / Math.max(1, points.length - 1)) * measuredWidth;

  // Clamp the hover tooltip to the container's actual width, using its
  // real measured size — not a fixed percentage guess — so it can never
  // render partly off-screen regardless of card width or tooltip content.
  useLayoutEffect(() => {
    if (hoverIdx == null || !tooltipRef.current || !containerRef.current) return;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const tooltipWidth = tooltipRef.current.offsetWidth;
    const pointLeft = (pointXPx(hoverIdx) / measuredWidth) * containerWidth;
    const fitsRight = pointLeft + TOOLTIP_MARGIN + tooltipWidth <= containerWidth;
    setTooltipOffset({ left: pointLeft, flip: !fitsRight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverIdx, measuredWidth, points.length]);

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
    const { x, y } = scale(points, width, height, { left: 0, right: 0, top: 0, bottom: 0 });
    const marketPts: Point[] = points.map((p, i) => [x(i), y(p.marketValue)]);
    const contribPts: Point[] = points.map((p, i) => [x(i), y(p.contributed)]);
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={smoothLinePath(contribPts)} fill="none" stroke="var(--color-contributed)" strokeWidth={1.5} strokeDasharray="3 3" />
        <path d={smoothLinePath(marketPts)} fill="none" stroke="var(--color-good)" strokeWidth={2} />
      </svg>
    );
  }

  const { x, y, maxVal, top, bottom } = scale(points, measuredWidth, HEIGHT, PAD);

  const marketPts: Point[] = points.map((p, i) => [x(i), y(p.marketValue)]);
  const contribPts: Point[] = points.map((p, i) => [x(i), y(p.contributed)]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((maxVal * f) / 1000));
  const tickIdx = monthTickIndices(points);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const viewX = relX * measuredWidth;
    // Nearest point by x-position.
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(x(i) - viewX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        ref={svgRef}
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${measuredWidth} ${HEIGHT}`}
        className="block overflow-visible"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={PAD.left - 6}
            y={y(t * 1000) + 3}
            textAnchor="end"
            style={{ fontSize: 10, fill: "var(--color-ink-3)", fontFamily: "var(--font-inter)" }}
          >
            ${t}k
          </text>
        ))}

        <path d={smoothAreaPath(contribPts, bottom)} fill="var(--color-contributed)" opacity={0.1} stroke="none" />
        <path d={smoothBandPath(marketPts, contribPts)} fill="var(--color-good)" opacity={0.13} stroke="none" />

        <path
          d={smoothLinePath(contribPts)}
          fill="none"
          stroke="var(--color-contributed)"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        <path d={smoothLinePath(marketPts)} fill="none" stroke="var(--color-good)" strokeWidth={2} />

        {tickIdx.map((i, n) => (
          <text
            key={i}
            x={x(i)}
            y={HEIGHT - 8}
            textAnchor={n === 0 ? "start" : n === tickIdx.length - 1 ? "end" : "middle"}
            style={{ fontSize: 11, fill: "var(--color-ink-3)", fontFamily: "var(--font-inter)" }}
          >
            {formatMonthLabel(points[i].date)}
          </text>
        ))}

        {hoverIdx != null && (
          <>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={top} y2={bottom} stroke="var(--color-border-strong)" strokeWidth={1} />
            <circle cx={x(hoverIdx)} cy={y(points[hoverIdx].marketValue)} r={3.5} fill="var(--color-good)" />
            <circle cx={x(hoverIdx)} cy={y(points[hoverIdx].contributed)} r={3.5} fill="var(--color-contributed)" />
          </>
        )}
      </svg>

      {hovered && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute top-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] shadow-lg"
          style={{
            left: tooltipOffset.left,
            transform: tooltipOffset.flip ? `translateX(calc(-100% - ${TOOLTIP_MARGIN}px))` : `translateX(${TOOLTIP_MARGIN}px)`,
          }}
        >
          <p className="text-ink-3">{formatShortDateLabel(hovered.date)}</p>
          <p className="text-ink">
            <span className="text-good">●</span> {formatMoney(hovered.marketValue)}
          </p>
          <p className="text-ink-2">
            <span className="text-contributed">●</span> {formatMoney(hovered.contributed)}
          </p>
        </div>
      )}

      {/* Rev 09 §2.3: the ONLY legend — centered beneath the plot. */}
      <div className="mt-1 flex items-center justify-center gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-3 rounded-full bg-good" aria-hidden />
          Market value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-3 border-t-2 border-dashed border-contributed" aria-hidden />
          Contribution
        </span>
      </div>
    </div>
  );
}
