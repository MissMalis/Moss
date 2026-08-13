// Validated pay-period math, ported verbatim from the Moss build brief §1.
// These are pure functions — do not "improve" the date math without re-running
// the assertions in the brief §6 (semimonthly month-end clamp, rent/Netflix
// window filing, variable true-up, auto-reserve, double-count guard).

export type Freq = "biweekly" | "semimonthly" | "weekly" | "monthly" | "one-off";

export interface IncomeForPeriods {
  freq: Freq;
  smDays?: [number, number]; // e.g. [1, 16], semimonthly only
  anchor?: string; // biweekly/weekly anchor date, or the one-off's date, ISO
  monthlyDay?: number; // monthly only
}

export interface PayWindow {
  payDate: string;
  start: string;
  end: string;
}

// Pay periods for a given month. freq: "biweekly" | "semimonthly"
// (Original two branches are the validated brief §1 logic — untouched.)
export function periodsForMonth(
  inc: IncomeForPeriods,
  year: number,
  month: number,
): PayWindow[] {
  const out: PayWindow[] = [];
  if (inc.freq === "semimonthly") {
    const [d1, d2] = inc.smDays!; // e.g. [1, 16]
    const mk = (day: number) => new Date(year, month, day).toISOString().slice(0, 10);
    out.push({ payDate: mk(d1), start: mk(d1), end: mk(d2 - 1) });
    const eom = new Date(year, month + 1, 0).getDate();
    out.push({ payDate: mk(d2), start: mk(d2), end: mk(eom) });
  } else if (inc.freq === "biweekly") {
    // biweekly: walk 14-day steps from a known anchor payday
    const d = new Date(inc.anchor + "T00:00:00");
    const ms = new Date(year, month, 1),
      me = new Date(year, month + 1, 0);
    while (d > ms) d.setDate(d.getDate() - 14);
    while (d <= me) {
      const pay = new Date(d),
        end = new Date(d);
      end.setDate(end.getDate() + 13);
      if (pay.getMonth() === month)
        out.push({
          payDate: pay.toISOString().slice(0, 10),
          start: pay.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        });
      d.setDate(d.getDate() + 14);
    }
  } else if (inc.freq === "weekly") {
    // weekly: same walk as biweekly, 7-day steps
    const d = new Date(inc.anchor + "T00:00:00");
    const ms = new Date(year, month, 1),
      me = new Date(year, month + 1, 0);
    while (d > ms) d.setDate(d.getDate() - 7);
    while (d <= me) {
      const pay = new Date(d),
        end = new Date(d);
      end.setDate(end.getDate() + 6);
      if (pay.getMonth() === month)
        out.push({
          payDate: pay.toISOString().slice(0, 10),
          start: pay.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        });
      d.setDate(d.getDate() + 7);
    }
  } else if (inc.freq === "monthly") {
    // monthly: one window, from this month's day to the day before next month's.
    const mk = (y: number, m: number, day: number) =>
      new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    const pay = mk(year, month, inc.monthlyDay!);
    const nextPay = mk(year, month + 1, inc.monthlyDay!);
    const end = new Date(nextPay);
    end.setDate(end.getDate() - 1);
    out.push({
      payDate: pay.toISOString().slice(0, 10),
      start: pay.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }
  // "one-off" isn't periodic — it's a single dated event handled separately
  // wherever income windows are consumed (see today.ts).
  return out;
}

export interface RecurringItemForOccurrence {
  day: number;
}

// Does a day-of-month recurring item fall in [start,end]? Clamps day for short months.
export function occurrenceInWindow(
  item: RecurringItemForOccurrence,
  startISO: string,
  endISO: string,
): string | null {
  const start = new Date(startISO + "T00:00:00"),
    end = new Date(endISO + "T00:00:00");
  for (let m = start.getMonth() - 1; m <= end.getMonth() + 1; m++) {
    const y = start.getFullYear();
    const occ = new Date(y, m, Math.min(item.day, new Date(y, m + 1, 0).getDate()));
    if (occ >= start && occ <= end) return occ.toISOString().slice(0, 10);
  }
  return null;
}

// Safe to Spend for the current window:
// income + rollover - earmarkedBills - autoReserve - loggedPurchases
export interface SafeToSpendInputs {
  income: number;
  rollover: number;
  earmarkedBills: number;
  autoReserve: number;
  loggedPurchases: number;
}

export function safeToSpend({
  income,
  rollover,
  earmarkedBills,
  autoReserve,
  loggedPurchases,
}: SafeToSpendInputs): number {
  return income + rollover - earmarkedBills - autoReserve - loggedPurchases;
}

// Business-day shift: v1 is weekend-only (shift prior or next, per setting).
// True Federal Reserve / bank holiday calendars are not machine-readable and
// are a v2 item — do not attempt to hardcode a holiday table here.
export type BizShift = "none" | "prior" | "next";

export function shiftForWeekend(dateISO: string, mode: BizShift): string {
  if (mode === "none") return dateISO;
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  if (day !== 0 && day !== 6) return dateISO;

  if (mode === "next") {
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  } else {
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}
