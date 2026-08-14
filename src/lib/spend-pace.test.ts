import { describe, expect, it } from "vitest";
import { daysUntil, dollarsPerDay } from "./spend-pace";

describe("daysUntil", () => {
  it("counts whole days between two ISO dates", () => {
    expect(daysUntil("2026-08-01", "2026-08-15")).toBe(14);
  });

  it("never goes negative when the target is in the past", () => {
    expect(daysUntil("2026-08-15", "2026-08-01")).toBe(0);
  });
});

describe("dollarsPerDay", () => {
  it("divides remaining Safe to Spend by days left", () => {
    expect(dollarsPerDay(952, 14)).toBeCloseTo(68, 0);
  });

  it("clamps a negative Safe to Spend to zero rather than showing a negative pace", () => {
    expect(dollarsPerDay(-100, 5)).toBe(0);
  });

  it("returns the raw amount (not Infinity) when there are zero days left", () => {
    expect(dollarsPerDay(200, 0)).toBe(200);
  });
});
