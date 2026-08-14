"use client";

import { useEffect, useRef, useState } from "react";
import { computeRingLayout } from "@/lib/ring-layout";
import { candyColorsForCategories } from "@/lib/candy-colors";
import { formatCompactMoney, formatMoney } from "@/lib/format";
import { IconGlyph } from "@/components/IconGlyph";

export interface RingCategory {
  name: string;
  emoji: string;
  amount: number;
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

  // Ring colors are computed over whatever's currently in `display` (the
  // full transitioning set, so a fading-out category keeps a sensible color
  // through its last frames); the legend only ever shows the final set.
  const ringColors = candyColorsForCategories(Object.keys(display));
  const legendColors = candyColorsForCategories(data.map((d) => d.name));

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="shrink-0"
        role="img"
        aria-label={`Where it goes: ${formatMoney(total)} spent this period`}
      >
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-card-soft)" strokeWidth={STROKE} />
        {segments.map((seg) => (
          <circle
            key={seg.name}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={ringColors.get(seg.name)}
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

      <div className="grid w-full grid-cols-2 gap-x-6 gap-y-2.5 sm:max-w-xs">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: legendColors.get(d.name) }}
              />
              <IconGlyph value={d.emoji} className="text-[13px]" />
              {d.name}
            </span>
            <span className="font-display text-[13.5px] font-medium text-ink">
              {formatMoney(d.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
