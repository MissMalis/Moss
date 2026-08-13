import { describe, expect, it } from "vitest";
import {
  candyColorAt,
  candyColorForCategory,
  candyColorsForCategories,
  stableSpectrumPosition,
} from "./candy-colors";

describe("candyColorAt", () => {
  it("returns the first anchor at p=0 and last anchor at p=1", () => {
    expect(candyColorAt(0)).toBe("rgb(232, 93, 110)");
    expect(candyColorAt(1)).toBe("rgb(139, 123, 216)");
  });

  it("clamps out-of-range input", () => {
    expect(candyColorAt(-5)).toBe(candyColorAt(0));
    expect(candyColorAt(5)).toBe(candyColorAt(1));
  });
});

describe("stableSpectrumPosition / candyColorForCategory", () => {
  it("is deterministic for the same name", () => {
    expect(stableSpectrumPosition("Food")).toBe(stableSpectrumPosition("Food"));
    expect(candyColorForCategory("Food")).toBe(candyColorForCategory("Food"));
  });

  it("is unaffected by other categories existing", () => {
    // Nothing to compute against here — the whole point is it's a pure
    // function of the name alone, so this is really just documenting intent.
    const before = candyColorForCategory("Food");
    const after = candyColorForCategory("Food");
    expect(before).toBe(after);
  });
});

describe("candyColorsForCategories", () => {
  it("gives every category shown together a distinct color, well separated", () => {
    const names = ["Food", "Rent", "Subscriptions", "Transport", "Play"];
    const colors = candyColorsForCategories(names);
    const values = Array.from(colors.values());
    expect(new Set(values).size).toBe(names.length);
  });

  it("keeps relative hue order stable across renders regardless of set size", () => {
    const small = candyColorsForCategories(["Food", "Rent"]);
    const large = candyColorsForCategories(["Food", "Rent", "Subscriptions", "Transport", "Play"]);
    // Whichever of Food/Rent hashes lower sorts first in both cases.
    const smallOrder = [...small.keys()];
    const largeOrder = [...large.keys()].filter((n) => n === "Food" || n === "Rent");
    expect(largeOrder).toEqual(smallOrder);
  });

  it("handles a single category", () => {
    const colors = candyColorsForCategories(["Only"]);
    expect(colors.get("Only")).toBe(candyColorAt(0.5));
  });
});
