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

/** Rev 06b §8: one pay-period widget with a Current ⇄ Next toggle, instead of two side-by-side cards. */
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
    <div>
      <div className="mb-2 inline-flex gap-1 rounded-md bg-card-soft p-0.5 text-[12px]">
        <button
          type="button"
          onClick={() => setWhich("current")}
          className={`rounded px-2.5 py-1 transition ${which === "current" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
        >
          Current period
        </button>
        <button
          type="button"
          onClick={() => setWhich("next")}
          className={`rounded px-2.5 py-1 transition ${which === "next" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
        >
          Next period
        </button>
      </div>
      <CurrentPeriodCard
        title={which === "current" ? "Current pay period" : "Next pay period"}
        window={active.window}
        occurrences={active.occurrences}
        categoryById={categoryById}
        todayISO={todayISO}
        emptyLabel={active.emptyLabel}
      />
    </div>
  );
}
