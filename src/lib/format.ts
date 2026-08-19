const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatShortDate(iso: string): { month: string; day: number } {
  const d = new Date(iso + "T00:00:00");
  return { month: MONTHS[d.getMonth()], day: d.getDate() };
}

/** "2026-08-01" / "2026-08-15" -> "Aug 1 – Aug 15" (drops the repeated month when both fall in it). */
export function formatDateRange(startISO: string, endISO: string): string {
  const start = formatShortDate(startISO);
  const end = formatShortDate(endISO);
  if (start.month === end.month) {
    return `${start.month} ${start.day} – ${end.day}`;
  }
  return `${start.month} ${start.day} – ${end.month} ${end.day}`;
}

export function formatShortDateLabel(iso: string): string {
  const { month, day } = formatShortDate(iso);
  return `${month} ${day}`;
}

export function formatMonthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return MONTHS[d.getMonth()];
}

/** Splits an amount into whole-dollar and cents strings for two-tone number display. */
export function splitMoney(n: number): { sign: string; dollars: string; cents: string } {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const dollars = Math.floor(abs).toLocaleString();
  const cents = Math.round((abs - Math.floor(abs)) * 100)
    .toString()
    .padStart(2, "0");
  return { sign, dollars, cents };
}

export function formatMoney(n: number): string {
  const { sign, dollars, cents } = splitMoney(n);
  return `${sign}$${dollars}.${cents}`;
}

/**
 * Rev 08 #10: the one canonical last-4 display, "···· 4021" — used
 * everywhere an account/card number shows (detail page header, Paid with,
 * Sweep's card picker) so the same account never shows two different mask
 * styles depending on which screen picked it.
 */
export function formatLast4(last4: string | null | undefined): string | null {
  return last4 ? `···· ${last4}` : null;
}

/** "$2.1K" for large amounts, plain "$842" under a thousand. */
export function formatCompactMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}$${Math.round(abs)}`;
}

const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  return ORDINALS[day % 10] ? `${day}${ORDINALS[day % 10].slice(-2)}` : `${day}th`;
}

interface FreqDescribable {
  freq: string;
  anchor_date: string | null;
  sm_day1: number;
  sm_day2: number;
}

/** Plain-English description of an income source's schedule. */
export function describeFrequency(source: FreqDescribable): string {
  switch (source.freq) {
    case "semimonthly":
      return `${ordinal(source.sm_day1)} & ${ordinal(source.sm_day2)} of the month`;
    case "biweekly":
      return source.anchor_date
        ? `Every other week from ${formatShortDateLabel(source.anchor_date)}`
        : "Every other week";
    case "weekly":
      return source.anchor_date
        ? `Every week from ${formatShortDateLabel(source.anchor_date)}`
        : "Every week";
    case "monthly":
      return `Monthly on the ${ordinal(source.sm_day1)}`;
    case "one-off":
      return source.anchor_date
        ? `One-time, ${formatShortDateLabel(source.anchor_date)}`
        : "One-time";
    default:
      return source.freq;
  }
}
