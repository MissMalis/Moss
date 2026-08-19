"use client";

import { useState } from "react";
import { CurrentPeriodCard } from "@/components/CurrentPeriodCard";
import type { PayWindow } from "@/lib/periods";
import type { ResolvedOccurrence } from "@/lib/recurring";

interface CategoryLike {
  name: string;
  emoji: string | null;
  color: string | null;
}

interface PeriodProps {
  window: PayWindow | null;
  occurrences: ResolvedOccurrence[];
  emptyLabel: string;
}

/**
 * Rev 06b §8/Rev 08 #11: one pay-period widget with a Current ⇄ Next
 * toggle, living inside the card's own header (top-right) instead of
 * floating above it — that floating row was what threw off the card's
 * top edge against Budgets' card beside it.
 */
export function PayPeriodToggle({
  current,
  next,
  categoryById,
  todayISO,
}: {
  current: PeriodProps;
  next: PeriodProps;
  categoryById: Map<string, CategoryLike>;
  todayISO: string;
}) {
  const [which, setWhich] = useState<"current" | "next">("current");
  const active = which === "current" ? current : next;

  return (
    <CurrentPeriodCard
      title={which === "current" ? "Current pay period" : "Next pay period"}
      window={active.window}
      occurrences={active.occurrences}
      categoryById={categoryById}
      todayISO={todayISO}
      emptyLabel={active.emptyLabel}
      toggle={
        <div className="inline-flex shrink-0 gap-1 rounded-md bg-card-soft p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => setWhich("current")}
            className={`rounded px-2.5 py-1 transition ${which === "current" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
          >
            Current
          </button>
          <button
            type="button"
            onClick={() => setWhich("next")}
            className={`rounded px-2.5 py-1 transition ${which === "next" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
          >
            Next
          </button>
        </div>
      }
    />
  );
}
