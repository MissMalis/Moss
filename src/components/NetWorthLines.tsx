"use client";

import { useEffect, useRef, useState } from "react";
import { smoothAreaPath, smoothBandPath, smoothLinePath, type Point } from "@/lib/svg-path";
import { formatMonthLabel, formatMoney, formatShortDateLabel } from "@/lib/format";
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

const FALLBACK_WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 44;
const PAD_BOTTOM = 24;

/**
 * Rev 05 §1.11/Rev 08 #3: every graph fills its card and is hoverable — a
 * vertical guide + tooltip at the nearest point.
 *
 * The viewBox's width is measured from the actual container, not a fixed
 * constant — an earlier fix (`preserveAspectRatio="none"` with a 640-unit
 * viewBox stretched to a wider container) closed the "dead space on the
 * right" gap but scaled X and Y independently, which warps stroke widths,
 * circle radii, and text glyphs (SVG applies that same non-uniform
 * transform to every child, not just the path geometry). Matching the
 * viewBox to the real pixel width makes the scale factor 1:1 on both axes
 * — full width AND no distortion.
 */
export function NetWorthLines({ points, variant = "full" }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(FALLBACK_WIDTH);

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

  const { x, y, maxVal, innerH } = scale(points, measuredWidth, HEIGHT, PAD_LEFT, PAD_BOTTOM);

  const marketPts: Point[] = points.map((p, i) => [x(i), y(p.marketValue)]);
  const contribPts: Point[] = points.map((p, i) => [x(i), y(p.contributed)]);
  const baselineY = innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((maxVal * f) / 1000));

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
  const tooltipLeft = hoverIdx != null ? (x(hoverIdx) / measuredWidth) * 100 : 0;
  const flipTooltip = tooltipLeft > 65;

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
            y={HEIGHT - 4}
            textAnchor="middle"
            style={{ fontSize: 11, fill: "var(--color-ink-3)", fontFamily: "var(--font-inter)" }}
          >
            {formatMonthLabel(points[i].date)}
          </text>
        ))}

        {hoverIdx != null && (
          <>
            <line
              x1={x(hoverIdx)}
              x2={x(hoverIdx)}
              y1={0}
              y2={innerH}
              stroke="var(--color-border-strong)"
              strokeWidth={1}
            />
            <circle cx={x(hoverIdx)} cy={y(points[hoverIdx].marketValue)} r={3.5} fill="var(--color-good)" />
            <circle cx={x(hoverIdx)} cy={y(points[hoverIdx].contributed)} r={3.5} fill="var(--color-contributed)" />
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] shadow-lg"
          style={{
            left: `${tooltipLeft}%`,
            transform: flipTooltip ? "translateX(-100%)" : "translateX(8px)",
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
    </div>
  );
}
