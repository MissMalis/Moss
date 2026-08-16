import { describe, expect, it } from "vitest";
import {
  periodsPerYear,
  computeAnnualEmployerMatch,
  computePerCheckEmployerMatch,
  contributionPctFromDollars,
  contributionDollarsFromPct,
} from "./employer-match";

describe("periodsPerYear", () => {
  it("maps every cadence to its paycheck count", () => {
    expect(periodsPerYear("weekly")).toBe(52);
    expect(periodsPerYear("biweekly")).toBe(26);
    expect(periodsPerYear("semimonthly")).toBe(24);
    expect(periodsPerYear("monthly")).toBe(12);
    expect(periodsPerYear("one-off")).toBe(0);
  });
});

describe("computeAnnualEmployerMatch", () => {
  const rule = { salaryAnnual: 100000, tier1LimitPct: 3, tier2LimitPct: 5, tier2RatePct: 50 };

  it("matches 100% dollar-for-dollar within tier 1", () => {
    // 2% contribution, entirely inside the 0-3% tier-1 band.
    expect(computeAnnualEmployerMatch(rule, 2)).toBe(2000);
  });

  it("caps tier 1 at its limit and adds 50% of the tier-2 overflow", () => {
    // 4% contribution: 3% at 100% = 3000, + 1% (the 3-4 band) at 50% = 500.
    expect(computeAnnualEmployerMatch(rule, 4)).toBe(3500);
  });

  it("caps entirely at tier 2's limit — contributing beyond Z% earns no extra match", () => {
    // 4% and 10% both land at the same match once tier 2 tops out at 5%.
    expect(computeAnnualEmployerMatch(rule, 10)).toBe(computeAnnualEmployerMatch(rule, 5));
    expect(computeAnnualEmployerMatch(rule, 5)).toBe(4000); // 3000 + (5-3)*0.5%*100000... = 3000+1000
  });

  it("is zero with no salary or no contribution", () => {
    expect(computeAnnualEmployerMatch({ ...rule, salaryAnnual: 0 }, 4)).toBe(0);
    expect(computeAnnualEmployerMatch(rule, 0)).toBe(0);
  });
});

describe("computePerCheckEmployerMatch", () => {
  it("divides the annual match evenly across a biweekly cadence", () => {
    const rule = { salaryAnnual: 104000, tier1LimitPct: 3, tier2LimitPct: 5, tier2RatePct: 50 };
    // 3% contribution = 3120 annual match / 26 checks.
    expect(computePerCheckEmployerMatch(rule, 3, "biweekly")).toBeCloseTo(3120 / 26, 2);
  });

  it("is zero for a one-off income source (no recurring cadence)", () => {
    const rule = { salaryAnnual: 100000, tier1LimitPct: 3, tier2LimitPct: 5, tier2RatePct: 50 };
    expect(computePerCheckEmployerMatch(rule, 3, "one-off")).toBe(0);
  });
});

describe("contribution % <-> $ conversion", () => {
  it("round-trips a percent through dollars and back", () => {
    const salary = 120000;
    const dollars = contributionDollarsFromPct(5, salary, "biweekly");
    expect(dollars).toBeCloseTo((0.05 * salary) / 26, 2);
    const pctBack = contributionPctFromDollars(dollars, salary, "biweekly");
    expect(pctBack).toBeCloseTo(5, 1);
  });

  it("is zero with no salary", () => {
    expect(contributionPctFromDollars(200, 0, "biweekly")).toBe(0);
  });
});
