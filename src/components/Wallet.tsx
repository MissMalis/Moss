import Link from "next/link";
import { formatMoney } from "@/lib/format";
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
  "from-[#343a44] via-[#20242c] to-[#0e1013]",
  "from-[#28323f] via-[#161b23] to-[#0b1220]",
  "from-[#463a26] via-[#241d10] to-[#14100a]",
  "from-[#28402f] via-[#132018] to-[#0a140f]",
  "from-[#3a2c46] via-[#1e1524] to-[#120a14]",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/**
 * Rev 09 §7/Rev 10 §8: cards only (credit cards + whichever of them is the
 * Sweep channel card) — a real digital-wallet look, a gently overlapping
 * stack of glossy dark card faces, not a flat list. The Card/Info toggle
 * from Rev 09 is gone; there's no non-card view left to toggle to.
 */
export function Wallet({ entries }: { entries: WalletEntry[] }) {
  return (
    <div>
      <p className="text-[15px] font-medium text-ink">Wallet</p>

      <div className={`mt-3 ${SCROLL_LIST}`}>
        {entries.length === 0 ? (
          <p className="text-[13px] text-ink-3">No cards yet.</p>
        ) : (
          <div className="pb-2">
            {entries.map((e, i) => (
              <Link
                key={e.id}
                href={`/net-worth/${e.id}`}
                style={{ zIndex: i }}
                className={`relative block overflow-hidden rounded-2xl bg-gradient-to-br p-3.5 text-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.35)] ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-6px_rgba(0,0,0,0.45)] ${gradientFor(e.id)} ${i > 0 ? "-mt-9" : ""}`}
              >
                {/* A soft diagonal sheen — the "glossy" part of a glossy card face. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 35%)" }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="text-[10.5px] font-medium uppercase tracking-wide text-white/60">{e.institution || e.type}</span>
                  {e.isChannel && (
                    <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide">Channel</span>
                  )}
                </div>
                <p className="relative mt-3 font-mono text-[13px] tracking-[0.3em] text-white/85 tabular-nums">
                  •••• •••• •••• {e.last4 ?? "····"}
                </p>
                <div className="relative mt-3 flex items-end justify-between gap-2">
                  <span className="min-w-0 truncate text-[12.5px] text-white/80">{e.name}</span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatMoney(e.balance)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
