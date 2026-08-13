import { describe, expect, it } from "vitest";
import { occurrenceInWindow, periodsForMonth, safeToSpend } from "./periods";

describe("periodsForMonth", () => {
  it("splits a 31-day month at [1,16] with P2 ending on the 31st", () => {
    // month is 0-indexed: 0 = January (31 days)
    const [p1, p2] = periodsForMonth(
      { freq: "semimonthly", smDays: [1, 16] },
      2026,
      0,
    );
    expect(p1).toEqual({ payDate: "2026-01-01", start: "2026-01-01", end: "2026-01-15" });
    expect(p2).toEqual({ payDate: "2026-01-16", start: "2026-01-16", end: "2026-01-31" });
  });

  it("ends P2 on the 30th for a 30-day month", () => {
    // month 3 = April (30 days)
    const [, p2] = periodsForMonth(
      { freq: "semimonthly", smDays: [1, 16] },
      2026,
      3,
    );
    expect(p2.end).toBe("2026-04-30");
  });
});

describe("occurrenceInWindow", () => {
  it("files rent (day 1) into P1, never P2", () => {
    const [p1, p2] = periodsForMonth(
      { freq: "semimonthly", smDays: [1, 16] },
      2026,
      0,
    );
    expect(occurrenceInWindow({ day: 1 }, p1.start, p1.end)).toBe("2026-01-01");
    expect(occurrenceInWindow({ day: 1 }, p2.start, p2.end)).toBeNull();
  });

  it("files Netflix (day 20) into P2, never P1", () => {
    const [p1, p2] = periodsForMonth(
      { freq: "semimonthly", smDays: [1, 16] },
      2026,
      0,
    );
    expect(occurrenceInWindow({ day: 20 }, p2.start, p2.end)).toBe("2026-01-20");
    expect(occurrenceInWindow({ day: 20 }, p1.start, p1.end)).toBeNull();
  });
});

describe("safeToSpend", () => {
  it("variable bill true-up: actual $150 vs estimate $180 releases $30", () => {
    const estimated = safeToSpend({
      income: 1000,
      rollover: 0,
      earmarkedBills: 180,
      autoReserve: 0,
      loggedPurchases: 0,
    });
    const actual = safeToSpend({
      income: 1000,
      rollover: 0,
      earmarkedBills: 150,
      autoReserve: 0,
      loggedPurchases: 0,
    });
    expect(actual - estimated).toBe(30);
  });

  it("variable bill true-up: actual $210 vs estimate $180 pulls $30", () => {
    const estimated = safeToSpend({
      income: 1000,
      rollover: 0,
      earmarkedBills: 180,
      autoReserve: 0,
      loggedPurchases: 0,
    });
    const actual = safeToSpend({
      income: 1000,
      rollover: 0,
      earmarkedBills: 210,
      autoReserve: 0,
      loggedPurchases: 0,
    });
    expect(actual - estimated).toBe(-30);
  });

  it("auto-reserve: a $400 shortfall on the next paycheck drops today's Safe to Spend by $400", () => {
    const withoutReserve = safeToSpend({
      income: 1000,
      rollover: 0,
      earmarkedBills: 200,
      autoReserve: 0,
      loggedPurchases: 0,
    });
    const withReserve = safeToSpend({
      income: 1000,
      rollover: 0,
      earmarkedBills: 200,
      autoReserve: 400,
      loggedPurchases: 0,
    });
    expect(withoutReserve - withReserve).toBe(400);
  });
});
