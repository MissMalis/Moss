// Rev 04 §1.5: "in X days" / "was due X days ago" instead of a bare day
// number, color-graded as it approaches. Not used for the calendar strip,
// which has its own per-day grid.

export type CountdownTone = "good" | "hold" | "bad";

export interface Countdown {
  days: number; // signed: negative = past due
  label: string;
  tone: CountdownTone;
}

export function daysFromToday(dateISO: string, todayISO: string): number {
  const date = new Date(dateISO + "T00:00:00");
  const today = new Date(todayISO + "T00:00:00");
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

export function countdownFor(dateISO: string, todayISO: string): Countdown {
  const days = daysFromToday(dateISO, todayISO);

  if (days < 0) {
    const overdue = Math.abs(days);
    return { days, label: `was due ${overdue} day${overdue === 1 ? "" : "s"} ago`, tone: "bad" };
  }
  if (days === 0) {
    return { days, label: "today", tone: "bad" };
  }
  if (days <= 3) {
    return { days, label: `in ${days} day${days === 1 ? "" : "s"}`, tone: "bad" };
  }
  if (days <= 10) {
    return { days, label: `in ${days} day${days === 1 ? "" : "s"}`, tone: "hold" };
  }
  return { days, label: `in ${days} day${days === 1 ? "" : "s"}`, tone: "good" };
}
