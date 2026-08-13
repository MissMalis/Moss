import { describe, expect, it } from "vitest";
import {
  computeAutoReserve,
  findCurrentWindow,
  findFutureWindows,
  netIncomeForWindow,
  windowsAround,
} from "./today";

const biweekly = {
  id: "src1",
  net_per_check: 2000,
  freq: "biweekly" as const,
  anchor_date: "2026-01-02", // a Friday
  sm_day1: 1,
  sm_day2: 16,
};

describe("windowsAround / findCurrentWindow", () => {
  it("finds the window containing today", () => {
    const windows = windowsAround(biweekly, "2026-01-10");
    const current = findCurrentWindow(windows, "2026-01-10");
    expect(current).not.toBeNull();
    expect(current!.start <= "2026-01-10" && current!.end >= "2026-01-10").toBe(true);
  });

  it("finds the next 2 windows after the current one", () => {
    const windows = windowsAround(biweekly, "2026-01-10");
    const current = findCurrentWindow(windows, "2026-01-10")!;
    const future = findFutureWindows(windows, current, 2);
    expect(future).toHaveLength(2);
    expect(future[0].payDate > current.payDate).toBe(true);
    expect(future[1].payDate > future[0].payDate).toBe(true);
  });
});

describe("netIncomeForWindow", () => {
  it("subtracts deductions from net_per_check for each pay event in the window", () => {
    const windows = windowsAround(biweekly, "2026-01-10");
    const current = findCurrentWindow(windows, "2026-01-10")!;
    const deductions = [
      { id: "d1", income_source_id: "src1", amount: 150, employer_match: 75, target_account_key: "hsa" },
    ];
    const income = netIncomeForWindow([biweekly], deductions, current, "2026-01-10");
    expect(income).toBe(2000 - 150);
  });
});

describe("computeAutoReserve", () => {
  it("pulls a $400 shortfall from the next paycheck into today's reserve, and shows the offending pay date", () => {
    const windows = windowsAround(biweekly, "2026-01-10");
    const current = findCurrentWindow(windows, "2026-01-10")!;
    const future = findFutureWindows(windows, current, 1)[0];

    const recurringItems = [
      {
        id: "bigbill",
        name: "Insurance",
        amount: 2400, // 2400 - 2000 income = 400 shortfall
        is_variable: false,
        day_of_month: new Date(future.start + "T00:00:00").getDate(),
        active: true,
        category_id: null,
      },
    ];

    const result = computeAutoReserve(
      biweekly,
      [biweekly],
      [],
      recurringItems,
      new Map(),
      current,
      "2026-01-10",
      2,
    );

    expect(result.reserve).toBe(400);
    expect(result.reasons[0].payDate).toBe(future.payDate);
  });

  it("reserves nothing when future windows are affordable", () => {
    const windows = windowsAround(biweekly, "2026-01-10");
    const current = findCurrentWindow(windows, "2026-01-10")!;

    const result = computeAutoReserve(biweekly, [biweekly], [], [], new Map(), current, "2026-01-10", 2);
    expect(result.reserve).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });
});
