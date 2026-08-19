"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney, formatLast4 } from "@/lib/format";
import { IconCircle } from "@/components/IconCircle";
import { defaultAccountIcon } from "@/lib/net-worth";
import { SCROLL_LIST } from "@/lib/ui";

export interface WalletEntry {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  institution: string | null;
  last4: string | null;
  balance: number;
  isChannel: boolean;
}

// Deliberately fixed dark tones, not theme tokens — this mimics a physical
// card face, which stays dark regardless of the app's light/dark mode.
const GRADIENTS = [
  "from-[#2b2f36] to-[#0e1013]",
  "from-[#1f2937] to-[#0b1220]",
  "from-[#3a2f1f] to-[#14100a]",
  "from-[#1f3a2f] to-[#0a140f]",
  "from-[#2f1f3a] to-[#120a14]",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * Rev 09 §7: one entry per wallet-relevant account/card (credit cards,
 * bank accounts, the channel card among them) with a generic techy mock
 * card face — no real brand logos — toggleable to a plain info row.
 */
export function Wallet({ entries }: { entries: WalletEntry[] }) {
  const [view, setView] = useState<"card" | "info">("card");

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-medium text-ink">Wallet</p>
        <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5 text-[11.5px]">
          <button
            type="button"
            onClick={() => setView("card")}
            className={`rounded-full px-2.5 py-1 transition ${view === "card" ? "bg-ink text-white" : "text-ink-3 hover:text-ink"}`}
          >
            Card
          </button>
          <button
            type="button"
            onClick={() => setView("info")}
            className={`rounded-full px-2.5 py-1 transition ${view === "info" ? "bg-ink text-white" : "text-ink-3 hover:text-ink"}`}
          >
            Info
          </button>
        </div>
      </div>

      <div className={`mt-3 space-y-2 ${SCROLL_LIST}`}>
        {entries.length === 0 ? (
          <p className="text-[13px] text-ink-3">No linked accounts or cards yet.</p>
        ) : view === "card" ? (
          entries.map((e) => (
            <Link
              key={e.id}
              href={`/net-worth/${e.id}`}
              className={`block rounded-xl bg-gradient-to-br p-3 text-white shadow-sm transition hover:opacity-90 ${gradientFor(e.id)}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-wide text-white/60">{e.institution || e.type}</span>
                {e.isChannel && (
                  <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide">Channel</span>
                )}
              </div>
              <p className="mt-3 text-[13px] tracking-[0.2em] text-white/80 tabular-nums">
                •••• •••• •••• {e.last4 ?? "····"}
              </p>
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] text-white/90">{e.name}</span>
                <span className="shrink-0 text-[14px] font-medium tabular-nums">{formatMoney(e.balance)}</span>
              </div>
            </Link>
          ))
        ) : (
          entries.map((e) => (
            <Link
              key={e.id}
              href={`/net-worth/${e.id}`}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition hover:bg-card-soft"
            >
              <IconCircle value={e.icon ?? defaultAccountIcon(e.type)} label={e.name} variant="tinted" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">{e.name}</p>
                <p className="truncate text-[11.5px] text-ink-3">
                  {e.type}
                  {e.institution ? ` · ${e.institution}` : ""}
                  {formatLast4(e.last4) ? ` · ${formatLast4(e.last4)}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[13px] text-ink tabular-nums">{formatMoney(e.balance)}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
