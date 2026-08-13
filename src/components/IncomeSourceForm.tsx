"use client";

import { useState } from "react";
import { createIncomeSource } from "@/lib/actions/income";
import { BTN_SOLID, INPUT, LABEL } from "@/lib/ui";
import { Tooltip } from "@/components/Tooltip";

type Freq = "biweekly" | "semimonthly" | "weekly" | "monthly" | "one-off";

const FREQ_OPTIONS: { value: Freq; label: string }[] = [
  { value: "biweekly", label: "Every other week" },
  { value: "weekly", label: "Every week" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Once a month" },
  { value: "one-off", label: "One-time" },
];

export function IncomeSourceForm() {
  const [freq, setFreq] = useState<Freq>("biweekly");

  return (
    <form action={createIncomeSource} className="mt-3 flex flex-wrap items-end gap-3">
      <label className={LABEL}>
        Name
        <input name="name" required placeholder="Paycheck" className={INPUT} />
      </label>
      <label className={LABEL}>
        Amount per deposit
        <input
          type="number"
          step="0.01"
          name="net_per_check"
          defaultValue={0}
          className={`w-32 ${INPUT}`}
        />
      </label>
      <label className={LABEL}>
        How often
        <select
          name="freq"
          value={freq}
          onChange={(e) => setFreq(e.target.value as Freq)}
          className={INPUT}
        >
          {FREQ_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      {(freq === "biweekly" || freq === "weekly") && (
        <label className={LABEL}>
          Anchor payday
          <Tooltip text="One real payday to count from — we count every 7 or 14 days out from here." />
          <input type="date" name="anchor_date" required className={INPUT} />
        </label>
      )}

      {freq === "one-off" && (
        <label className={LABEL}>
          Date it lands
          <input type="date" name="anchor_date" required className={INPUT} />
        </label>
      )}

      {freq === "monthly" && (
        <label className={LABEL}>
          Day of month
          <input
            type="number"
            min={1}
            max={31}
            name="sm_day1"
            defaultValue={1}
            className={`w-20 ${INPUT}`}
          />
        </label>
      )}

      {freq === "semimonthly" && (
        <>
          <label className={LABEL}>
            First day
            <input
              type="number"
              min={1}
              max={28}
              name="sm_day1"
              defaultValue={1}
              className={`w-20 ${INPUT}`}
            />
          </label>
          <label className={LABEL}>
            Second day
            <input
              type="number"
              min={2}
              max={28}
              name="sm_day2"
              defaultValue={16}
              className={`w-20 ${INPUT}`}
            />
          </label>
        </>
      )}

      <button type="submit" className={BTN_SOLID}>
        Add income
      </button>
    </form>
  );
}
