import { describe, expect, it } from "vitest";
import { computeRingLayout, GAP_DEG } from "./ring-layout";

const CIRC = 2 * Math.PI * 100;

describe("computeRingLayout", () => {
  it("reserves equal gap space regardless of how lopsided the amounts are", () => {
    const layout = computeRingLayout(
      [
        { name: "Rent", value: 9900 },
        { name: "Coffee", value: 1 },
      ],
      CIRC,
    );
    const gapLen = CIRC * (GAP_DEG / 360);
    const totalUsed = layout.reduce((s, seg) => s + seg.length, 0) + layout.length * gapLen;
    expect(totalUsed).toBeCloseTo(CIRC, 5);
    // Even the tiny sliver keeps a nonzero length, never swallowed by the gap.
    expect(layout[1].length).toBeGreaterThan(0);
  });

  it("splits evenly for equal values", () => {
    const layout = computeRingLayout(
      [
        { name: "A", value: 50 },
        { name: "B", value: 50 },
      ],
      CIRC,
    );
    expect(layout[0].length).toBeCloseTo(layout[1].length, 5);
  });

  it("advances offset by length + gap each step", () => {
    const layout = computeRingLayout(
      [
        { name: "A", value: 1 },
        { name: "B", value: 1 },
        { name: "C", value: 1 },
      ],
      CIRC,
    );
    const gapLen = CIRC * (GAP_DEG / 360);
    expect(layout[1].offset).toBeCloseTo(layout[0].length + gapLen, 5);
    expect(layout[2].offset).toBeCloseTo(layout[1].offset + layout[1].length + gapLen, 5);
  });

  it("returns an empty layout for no categories", () => {
    expect(computeRingLayout([], CIRC)).toEqual([]);
  });

  it("handles a single category (fills everything but the reserved gap)", () => {
    const layout = computeRingLayout([{ name: "Only", value: 100 }], CIRC);
    const gapLen = CIRC * (GAP_DEG / 360);
    expect(layout[0].length).toBeCloseTo(CIRC - gapLen, 5);
  });
});
