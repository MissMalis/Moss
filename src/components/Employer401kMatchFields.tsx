import { Tooltip } from "@/components/Tooltip";
import { INPUT } from "@/lib/ui";

/** Rev 06b v2 §6: "Match: 100% up to __%, then __% up to __%" — one aligned row, explanation in a `?`. Shared by the wizard and the edit form. */
export function Employer401kMatchFields({
  tier1Default,
  tier2RateDefault,
  tier2LimitDefault,
}: {
  tier1Default?: number | string;
  tier2RateDefault?: number | string;
  tier2LimitDefault?: number | string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
      <span>Match: 100% up to</span>
      <input type="number" step="0.1" name="match_tier1_pct" defaultValue={tier1Default ?? ""} className={`w-16 text-center ${INPUT}`} />
      <span>%, then</span>
      <input type="number" step="0.1" name="match_tier2_rate_pct" defaultValue={tier2RateDefault ?? ""} className={`w-16 text-center ${INPUT}`} />
      <span>% up to</span>
      <input type="number" step="0.1" name="match_tier2_limit_pct" defaultValue={tier2LimitDefault ?? ""} className={`w-16 text-center ${INPUT}`} />
      <span>%</span>
      <Tooltip text="E.g. 100% up to 3%, then 50% up to 5% — your employer matches every dollar you contribute up to 3% of salary, then 50 cents on the dollar for the next 2%. Uses your salary below to compute the actual employer contribution." />
    </div>
  );
}
