"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { TickerUpdatedAt } from "@/components/TickerUpdatedAt";

export interface TickerIndex {
  symbol: string;
  label: string;
  value: number;
  prev_close: number;
  updated_at: string;
}

const SYMBOL_ORDER = ["SPX", "DJI", "IXIC", "RUT", "US10Y"];
const POLL_MS = 20_000;

function formatValue(idx: TickerIndex): string {
  // The 10-year yield is a rate, not a price — no dollar sign.
  if (idx.symbol === "US10Y") return `${idx.value.toFixed(2)}%`;
  return formatMoney(idx.value);
}

/**
 * Rev 05 §3.1/Rev 08 #8/Rev 10 §3.1: a true full-bleed banner — black,
 * skinny, edge to edge across the full screen width, not a rounded card
 * contained by the layout's max-width. Breaks out of the centered <main>
 * via the classic 100vw + negative-margin trick, and pulls up by
 * `<main>`'s own `pt-8` (the app layout's page-content top padding) so it
 * sits flush against the nav bar instead of leaving a grey gap.
 *
 * Polls /api/market-indices/refresh every 20s and re-renders on a
 * successful fetch; a failed fetch is silently ignored so the banner
 * always shows the last good values instead of blanking or freezing on
 * an error state.
 */
export function TickerBar({ indices }: { indices: TickerIndex[] }) {
  const [current, setCurrent] = useState(indices);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local (polled) state when the server-rendered prop itself changes, e.g. a client-side nav back to this page; not synchronizing an external system.
    setCurrent(indices);
  }, [indices]);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/market-indices/refresh", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { indices?: TickerIndex[] };
        if (!data.indices || cancelled) return;
        const sorted = [...data.indices].sort((a, b) => SYMBOL_ORDER.indexOf(a.symbol) - SYMBOL_ORDER.indexOf(b.symbol));
        setCurrent(sorted);
      } catch {
        // Fetch failed — keep whatever's currently displayed.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (current.length === 0) return null;

  // The most recent write across all rows, so it's honest about
  // staleness even for the one row (US10Y) that never gets a live poll.
  const latestUpdate = current.reduce((max, idx) => (idx.updated_at > max ? idx.updated_at : max), current[0].updated_at);

  return (
    <div className="relative left-1/2 -mt-8 -ml-[50vw] w-screen bg-ink">
      <div className="mx-auto flex h-10 max-w-[1440px] items-center gap-4 px-6 md:px-10">
        <div className="flex flex-1 items-center justify-evenly">
          {current.map((idx) => {
            const delta = idx.value - idx.prev_close;
            const pct = idx.prev_close !== 0 ? (delta / idx.prev_close) * 100 : 0;
            const up = delta >= 0;
            return (
              <div key={idx.symbol} className="flex items-center gap-2 text-[12px]">
                <span className="text-bg/60">{idx.label}</span>
                <span className="text-bg tabular-nums">{formatValue(idx)}</span>
                <span className={`tabular-nums ${up ? "text-good" : "text-bad"}`}>
                  {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="shrink-0 text-[11px]">
          <TickerUpdatedAt isoTimestamp={latestUpdate} />
        </div>
      </div>
    </div>
  );
}
