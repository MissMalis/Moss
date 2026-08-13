import { describe, expect, it } from "vitest";
import { buildOccurrencesForWindow, rollingAverage, sumEarmarked } from "./recurring";

const rent = {
  id: "rent",
  name: "Rent",
  amount: 1200,
  is_variable: false,
  day_of_month: 1,
  active: true,
  category_id: null,
};

const pseg = {
  id: "pseg",
  name: "PSEG",
  amount: 180, // current estimate
  is_variable: true,
  day_of_month: 10,
  active: true,
  category_id: null,
};

describe("buildOccurrencesForWindow", () => {
  it("uses the estimate before posting", () => {
    const [occ] = buildOccurrencesForWindow([pseg], new Map(), "2026-01-01", "2026-01-15");
    expect(occ.amount).toBe(180);
    expect(occ.isEstimate).toBe(true);
  });

  it("true-up: actual $150 vs estimate $180 shows the lower actual once posted", () => {
    const state = new Map([
      ["pseg|2026-01-10", { skipped: false, override_amount: null, posted: true, actual_amount: 150 }],
    ]);
    const [occ] = buildOccurrencesForWindow([pseg], state, "2026-01-01", "2026-01-15");
    expect(occ.amount).toBe(150);
    expect(occ.isEstimate).toBe(false);
  });

  it("true-up: actual $210 vs estimate $180 shows the higher actual once posted", () => {
    const state = new Map([
      ["pseg|2026-01-10", { skipped: false, override_amount: null, posted: true, actual_amount: 210 }],
    ]);
    const [occ] = buildOccurrencesForWindow([pseg], state, "2026-01-01", "2026-01-15");
    expect(occ.amount).toBe(210);
  });

  it("skipped occurrences are excluded from the earmarked total", () => {
    const state = new Map([
      ["rent|2026-01-01", { skipped: true, override_amount: null, posted: false, actual_amount: null }],
    ]);
    const occs = buildOccurrencesForWindow([rent], state, "2026-01-01", "2026-01-15");
    expect(occs[0].skipped).toBe(true);
    expect(sumEarmarked(occs)).toBe(0);
  });

  it("edit-once override applies only to that occurrence, not the item default", () => {
    const state = new Map([
      ["rent|2026-01-01", { skipped: false, override_amount: 1300, posted: false, actual_amount: null }],
    ]);
    const occs = buildOccurrencesForWindow([rent], state, "2026-01-01", "2026-01-15");
    expect(occs[0].amount).toBe(1300);
    expect(rent.amount).toBe(1200); // item default untouched
  });

  it("inactive items produce no occurrence", () => {
    const occs = buildOccurrencesForWindow(
      [{ ...rent, active: false }],
      new Map(),
      "2026-01-01",
      "2026-01-15",
    );
    expect(occs).toHaveLength(0);
  });
});

describe("rollingAverage", () => {
  it("averages up to the last 3 actuals, most-recent first", () => {
    expect(rollingAverage([150, 210, 180, 999])).toBe(180); // (150+210+180)/3
  });

  it("returns null with no history", () => {
    expect(rollingAverage([])).toBeNull();
  });
});
