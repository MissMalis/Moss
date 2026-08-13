"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BTN_GHOST } from "@/lib/ui";

export function RefreshPricesButton({ symbols }: { symbols: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (symbols.length === 0) return null;

  async function refresh() {
    setError(null);
    try {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't refresh prices");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Couldn't reach the market data service");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={refresh} disabled={pending} className={BTN_GHOST}>
        {pending ? "Refreshing…" : "Refresh prices"}
      </button>
      {error && <span className="text-[12.5px] text-bad">{error}</span>}
    </div>
  );
}
