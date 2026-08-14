import { describe, expect, it } from "vitest";
import { countdownFor, daysFromToday } from "./countdown";

const TODAY = "2026-08-13";

describe("daysFromToday", () => {
  it("is positive for a future date", () => {
    expect(daysFromToday("2026-08-16", TODAY)).toBe(3);
  });

  it("is negative for a past date", () => {
    expect(daysFromToday("2026-08-10", TODAY)).toBe(-3);
  });

  it("is zero for today", () => {
    expect(daysFromToday(TODAY, TODAY)).toBe(0);
  });
});

describe("countdownFor", () => {
  it("labels a past-due date and grades it bad", () => {
    const c = countdownFor("2026-08-10", TODAY);
    expect(c.label).toBe("was due 3 days ago");
    expect(c.tone).toBe("bad");
  });

  it("labels today as due today, graded bad", () => {
    const c = countdownFor(TODAY, TODAY);
    expect(c.label).toBe("today");
    expect(c.tone).toBe("bad");
  });

  it("grades within 3 days as bad (urgent)", () => {
    const c = countdownFor("2026-08-16", TODAY);
    expect(c.label).toBe("in 3 days");
    expect(c.tone).toBe("bad");
  });

  it("grades 4-10 days out as hold (amber)", () => {
    const c = countdownFor("2026-08-20", TODAY);
    expect(c.label).toBe("in 7 days");
    expect(c.tone).toBe("hold");
  });

  it("grades beyond 10 days as good (green)", () => {
    const c = countdownFor("2026-08-30", TODAY);
    expect(c.label).toBe("in 17 days");
    expect(c.tone).toBe("good");
  });

  it("uses singular day wording for exactly one day", () => {
    expect(countdownFor("2026-08-14", TODAY).label).toBe("in 1 day");
    expect(countdownFor("2026-08-12", TODAY).label).toBe("was due 1 day ago");
  });
});
