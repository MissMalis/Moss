import { describe, expect, it } from "vitest";
import { smoothAreaPath, smoothBandPath, smoothLinePath } from "./svg-path";

describe("smoothLinePath", () => {
  it("starts at the first point", () => {
    const d = smoothLinePath([
      [0, 10],
      [5, 4],
      [10, 8],
    ]);
    expect(d.startsWith("M 0 10")).toBe(true);
  });

  it("produces a cubic segment per gap between points", () => {
    const d = smoothLinePath([
      [0, 0],
      [1, 1],
      [2, 0],
    ]);
    expect(d.match(/C /g)?.length).toBe(2);
  });

  it("handles a single point without throwing", () => {
    expect(smoothLinePath([[5, 5]])).toBe("M 5 5");
  });
});

describe("smoothAreaPath", () => {
  it("closes down to the baseline", () => {
    const d = smoothAreaPath(
      [
        [0, 10],
        [10, 5],
      ],
      50,
    );
    expect(d.endsWith("L 0 50 Z")).toBe(true);
  });
});

describe("smoothBandPath", () => {
  it("traces the top line then the bottom line in reverse, closed", () => {
    const d = smoothBandPath(
      [
        [0, 10],
        [10, 5],
      ],
      [
        [0, 20],
        [10, 15],
      ],
    );
    expect(d.startsWith("M 0 10")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });
});
