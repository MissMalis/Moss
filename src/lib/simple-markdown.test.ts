import { describe, expect, it } from "vitest";
import { parseBoldSegments } from "./simple-markdown";

describe("parseBoldSegments", () => {
  it("returns a single non-bold segment for plain text", () => {
    expect(parseBoldSegments("just plain text")).toEqual([{ text: "just plain text", bold: false }]);
  });

  it("extracts a bold segment in the middle", () => {
    expect(parseBoldSegments("pay off your **credit card** first")).toEqual([
      { text: "pay off your ", bold: false },
      { text: "credit card", bold: true },
      { text: " first", bold: false },
    ]);
  });

  it("handles multiple bold segments", () => {
    expect(parseBoldSegments("**yes** you can, **easily**")).toEqual([
      { text: "yes", bold: true },
      { text: " you can, ", bold: false },
      { text: "easily", bold: true },
    ]);
  });

  it("handles a bold segment at the very end with nothing trailing", () => {
    expect(parseBoldSegments("do this **now**")).toEqual([
      { text: "do this ", bold: false },
      { text: "now", bold: true },
    ]);
  });
});
