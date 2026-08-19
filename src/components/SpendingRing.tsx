"use client";

import { useEffect, useRef, useState } from "react";
import { computeRingLayout } from "@/lib/ring-layout";
import { candyColorForCategory } from "@/lib/candy-colors";
import { formatCompactMoney, formatMoney } from "@/lib/format";

export interface RingCategory {
  name: string;
  icon: string;
  amount: number;
  /** Rev 09 §4: the category's own stored hex — the ring must match it exactly, not an arbitrary palette. Falls back to the candy palette only when a category has no color set. */
  color?: string | null;
}

const SIZE = 240;
const STROKE = 21;
const DURATION = 650;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function SpendingRing({ data }: { data: RingCategory[] }) {
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const [display, setDisplay] = useState<Record<string, number>>(() =>
    Object.fromEntries(data.map((d) => [d.name, d.amount])),
  );
  const prevDataRef = useRef(data);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prevMap = Object.fromEntries(prevDataRef.current.map((d) => [d.name, d.amount]));
    const nextMap = Object.fromEntries(data.map((d) => [d.name, d.amount]));
    prevDataRef.current = data;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (reduceMotion) {
      rafRef.current = requestAnimationFrame(() => setDisplay(nextMap));
      return;
    }

    const names = Array.from(new Set([...Object.keys(prevMap), ...Object.keys(nextMap)]));
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / DURATION);
      if (t >= 1) {
        setDisplay(nextMap);
        return;
      }
      const eased = easeInOutCubic(t);
      const next: Record<string, number> = {};
      for (const name of names) {
        const from = prevMap[name] ?? 0;
        const to = nextMap[name] ?? 0;
        next[name] = from + (to - from) * eased;
      }
      setDisplay(next);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // Re-run whenever the underlying amounts change, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data.map((d) => [d.name, d.amount]))]);

  const layoutValues = Object.entries(display).map(([name, value]) => ({ name, value }));
  const segments = computeRingLayout(layoutValues, circumference);
  const total = data.reduce((s, d) => s + d.amount, 0);

  // Rev 09 §4: the ring must match each category's own stored color
  // exactly, not an arbitrary candy palette. `candyColorForCategory` is a
  // pure function of the name alone, so a fading-out category (still in
  // `display` mid-animation but no longer in `data`) still gets a stable
  // fallback color without needing to remember it.
  const colorMap = new Map(data.filter((d) => d.color).map((d) => [d.name, d.color as string]));
  function colorFor(name: string): string {
    return colorMap.get(name) ?? candyColorForCategory(name);
  }

  return (
    // Rev 08 #13: ring and legend stack (never side-by-side) — sharing a
    // row left the legend fighting the 240px ring for width inside a
    // narrower card (e.g. the 1fr side of Expenses' 1.4fr/1fr split),
    // squeezing its 2 columns too narrow for full names + amounts and
    // pushing content past the card's edge. Stacked, the legend always
    // gets the card's full width to lay out properly.
    <div className="flex flex-col items-center gap-4">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="shrink-0"
        role="img"
        aria-label={`Where it goes: ${formatMoney(total)} spent this period`}
      >
        {segments.map((seg) => (
          <circle
            key={seg.name}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={colorFor(seg.name)}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-display"
          style={{ fontSize: 30, fontWeight: 600, fill: "var(--color-ink)" }}
        >
          {formatCompactMoney(total)}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 12.5, fill: "var(--color-ink-2)", fontFamily: "var(--font-inter)" }}
        >
          spent
        </text>
      </svg>

      {/*
        Rev 08 #13: a rigid 2-col grid forced long category names to
        truncate to fit an equal-width cell. CSS multi-column flow instead
        — each entry is a full-width block within its column (so the name
        never needs an ellipsis, it just wraps), and `break-inside-avoid`
        keeps a [dot / name / amount] row from splitting across columns.
        `data` already arrives sorted by amount descending.
      */}
      <div className="w-full columns-2 gap-x-6">
        {data.map((d) => (
          <div key={d.name} className="mb-2.5 flex items-center justify-between gap-2 break-inside-avoid-column">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: colorFor(d.name) }}
              />
              {d.name}
            </span>
            <span className="shrink-0 font-display text-[13.5px] font-medium text-ink">
              {formatMoney(d.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
