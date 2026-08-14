import { countdownFor } from "@/lib/countdown";

const TONE_CLASS = {
  good: "text-good",
  hold: "text-hold",
  bad: "text-bad",
} as const;

/** Rev 04 §1.5: "in X days" / "was due X days ago", color-graded. */
export function CountdownBadge({ dateISO, todayISO }: { dateISO: string; todayISO: string }) {
  const c = countdownFor(dateISO, todayISO);
  return <span className={`text-[12px] ${TONE_CLASS[c.tone]}`}>{c.label}</span>;
}
