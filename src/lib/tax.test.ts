import { describe, expect, it } from "vitest";
import { applyTax } from "./tax";

describe("applyTax", () => {
  it("adds the location tax rate to the subtotal when the toggle is on", () => {
    expect(applyTax(100, true, 7)).toBe(107);
    expect(applyTax(50, true, 8.5)).toBe(54.25);
  });

  it("leaves the subtotal untouched when the toggle is off", () => {
    expect(applyTax(100, false, 6.625)).toBe(100);
  });

  it("leaves the subtotal untouched when no rate is configured", () => {
    expect(applyTax(100, true, null)).toBe(100);
  });

  it("leaves the subtotal untouched for a zero rate", () => {
    expect(applyTax(100, true, 0)).toBe(100);
  });
});
