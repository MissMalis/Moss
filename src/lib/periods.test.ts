import { describe, expect, it } from "vitest";
import {
  expectedPayDate,
  occurrenceInWindow,
  periodsForMonth,
  safeToSpend,
  shiftEarlyPay,
  shiftForWeekend,
} from "./periods";

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

  it("weekly: 7-day windows walking from the anchor", () => {
    const windows = periodsForMonth({ freq: "weekly", anchor: "2026-01-02" }, 2026, 0);
    expect(windows[0]).toEqual({ payDate: "2026-01-02", start: "2026-01-02", end: "2026-01-08" });
    expect(windows[1]).toEqual({ payDate: "2026-01-09", start: "2026-01-09", end: "2026-01-15" });
  });

  it("monthly: one window per month, ending the day before next month's occurrence", () => {
    const [w] = periodsForMonth({ freq: "monthly", monthlyDay: 15 }, 2026, 0);
    expect(w).toEqual({ payDate: "2026-01-15", start: "2026-01-15", end: "2026-02-14" });
  });

  it("monthly: clamps the day for short months", () => {
    // Feb 2026 has 28 days; day 31 clamps to the 28th.
    const [w] = periodsForMonth({ freq: "monthly", monthlyDay: 31 }, 2026, 1);
    expect(w.payDate).toBe("2026-02-28");
  });

  it("one-off: produces no periodic windows", () => {
    const windows = periodsForMonth({ freq: "one-off", anchor: "2026-01-10" }, 2026, 0);
    expect(windows).toEqual([]);
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

describe("shiftEarlyPay (rev 02 §9)", () => {
  it("moves the date earlier by the configured number of days", () => {
    expect(shiftEarlyPay("2026-01-17", 2)).toBe("2026-01-15");
  });

  it("is a no-op when no early-pay offset is configured", () => {
    expect(shiftEarlyPay("2026-01-17", 0)).toBe("2026-01-17");
  });
});

describe("expectedPayDate (rev 02 §9: early-pay offset applied before the business-day shift)", () => {
  it("applies the early-pay offset first, then nudges off a weekend it lands on", () => {
    // 2026-01-18 is a Sunday; pulling 1 day early lands on Saturday 1/17,
    // which then needs its own weekend shift forward to Monday 1/19.
    expect(expectedPayDate("2026-01-18", 1, "next")).toBe("2026-01-19");
  });

  it("with no early-pay offset, behaves exactly like shiftForWeekend alone", () => {
    expect(expectedPayDate("2026-01-17", 0, "next")).toBe(shiftForWeekend("2026-01-17", "next"));
  });

  it("with no weekend involved, only the early-pay offset applies", () => {
    // 2026-01-01 is a Thursday; 1 day early is Wednesday 2025-12-31, a weekday.
    expect(expectedPayDate("2026-01-01", 1, "next")).toBe("2025-12-31");
  });
});
