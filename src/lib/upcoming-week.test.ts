import { describe, expect, it } from "vitest";
import { weekStrip, type UpcomingItem } from "./upcoming-week";

function item(id: string, date: string, amount = 10): UpcomingItem {
  return { id, name: id, amount, date, categoryInitial: "R", categoryColor: "#000" };
}

describe("weekStrip", () => {
  it("always starts on Monday and ends on Sunday, 7 columns", () => {
    // 2026-08-12 is a Wednesday.
    const days = weekStrip("2026-08-12", []);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-08-10"); // Monday
    expect(days[6].date).toBe("2026-08-16"); // Sunday
  });

  it("marks today's column, even when today is a Monday", () => {
    const days = weekStrip("2026-08-10", []);
    expect(days[0].isToday).toBe(true);
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("buckets items into the matching day and sums a per-day total", () => {
    const days = weekStrip("2026-08-12", [item("rent", "2026-08-11", 1150), item("netflix", "2026-08-11", 15.49)]);
    const tuesday = days.find((d) => d.date === "2026-08-11")!;
    expect(tuesday.items.map((i) => i.id)).toEqual(["rent", "netflix"]);
    expect(tuesday.total).toBeCloseTo(1165.49, 2);
  });

  it("leaves days with nothing due as empty columns", () => {
    const days = weekStrip("2026-08-12", [item("rent", "2026-08-11", 1150)]);
    const monday = days.find((d) => d.date === "2026-08-10")!;
    expect(monday.items).toEqual([]);
    expect(monday.total).toBe(0);
  });
});
