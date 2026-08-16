// Rev 06b §4: 401(k)/403(b) employer-match modeling. Honest scope — a
// single two-tier rule ("100% up to X% of salary, then Y% up to Z%"),
// computed purely from salary + the user's contribution %. The result
// posts to the account as `employer_match` on the linked deduction; it
// never touches the paycheck or Safe-to-spend math (that money never came
// from the user's check).

export type PayFreq = "biweekly" | "semimonthly" | "weekly" | "monthly" | "one-off";

/** How many paychecks a year a given cadence produces. One-off has none. */
export function periodsPerYear(freq: PayFreq): number {
  switch (freq) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "semimonthly":
      return 24;
    case "monthly":
      return 12;
    default:
      return 0;
  }
}

export interface MatchRule {
  salaryAnnual: number;
  tier1LimitPct: number; // X: contribution % of salary matched at 100%
  tier2LimitPct: number; // Z: contribution % of salary up to which tier 2 applies
  tier2RatePct: number; // Y: match rate for the tier1..tier2 range
}

/** Annual employer match dollars for a given contribution % of salary. */
export function computeAnnualEmployerMatch(rule: MatchRule, contributionPctOfSalary: number): number {
  const { salaryAnnual, tier1LimitPct, tier2LimitPct, tier2RatePct } = rule;
  if (salaryAnnual <= 0 || contributionPctOfSalary <= 0) return 0;

  const tier1Pct = Math.min(contributionPctOfSalary, tier1LimitPct);
  const tier1Amount = (tier1Pct / 100) * salaryAnnual;

  const tier2Pct = Math.max(0, Math.min(contributionPctOfSalary, tier2LimitPct) - tier1LimitPct);
  const tier2Amount = (tier2Pct / 100) * salaryAnnual * (tier2RatePct / 100);

  return Math.round((tier1Amount + tier2Amount) * 100) / 100;
}

/** Per-paycheck employer match — what actually posts alongside the user's own contribution. */
export function computePerCheckEmployerMatch(rule: MatchRule, contributionPctOfSalary: number, freq: PayFreq): number {
  const periods = periodsPerYear(freq);
  if (periods === 0) return 0;
  return Math.round((computeAnnualEmployerMatch(rule, contributionPctOfSalary) / periods) * 100) / 100;
}

/** Converts a per-paycheck dollar contribution into % of salary (for the $ ⇄ % toggle). */
export function contributionPctFromDollars(dollarsPerCheck: number, salaryAnnual: number, freq: PayFreq): number {
  const periods = periodsPerYear(freq);
  if (salaryAnnual <= 0 || periods === 0) return 0;
  return Math.round(((dollarsPerCheck * periods) / salaryAnnual) * 10000) / 100;
}

/** Converts a % of salary into a per-paycheck dollar contribution (for the $ ⇄ % toggle). */
export function contributionDollarsFromPct(pct: number, salaryAnnual: number, freq: PayFreq): number {
  const periods = periodsPerYear(freq);
  if (periods === 0) return 0;
  return Math.round(((pct / 100) * salaryAnnual) / periods * 100) / 100;
}
