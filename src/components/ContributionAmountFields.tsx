"use client";

import { useState } from "react";
import { contributionDollarsFromPct, contributionPctFromDollars, type PayFreq } from "@/lib/employer-match";
import { INPUT, LABEL } from "@/lib/ui";

/**
 * Rev 06b v2 §6: contribution entered as a % of salary OR a $ per check —
 * Moss computes the other live from salary. Both fields are always
 * visible and stay in sync; there's no toggle to hide one.
 */
export function ContributionAmountFields({
  salary,
  freq,
  defaultAmount = 0,
  defaultPct = 0,
}: {
  salary: number | null;
  freq: PayFreq;
  defaultAmount?: number;
  defaultPct?: number;
}) {
  const [dollars, setDollars] = useState(defaultAmount);
  const [pct, setPct] = useState(defaultPct);

  function onDollarsChange(v: number) {
    setDollars(v);
    if (salary) setPct(contributionPctFromDollars(v, salary, freq));
  }
  function onPctChange(v: number) {
    setPct(v);
    if (salary) setDollars(contributionDollarsFromPct(v, salary, freq));
  }

  return (
    <div className="flex items-end gap-2">
      <label className={LABEL}>
        $ per check
        <input
          type="number"
          step="0.01"
          name="contribution_amount"
          value={dollars}
          onChange={(e) => onDollarsChange(Number(e.target.value))}
          className={`w-24 ${INPUT}`}
        />
      </label>
      <span className="pb-2 text-[12px] text-ink-3">or</span>
      <label className={LABEL}>
        % of salary
        <input
          type="number"
          step="0.1"
          name="contribution_pct"
          value={pct}
          onChange={(e) => onPctChange(Number(e.target.value))}
          disabled={!salary}
          title={salary ? undefined : "Set a salary above to convert to %"}
          className={`w-20 ${INPUT}`}
        />
      </label>
    </div>
  );
}
