// Shared chrome classnames — kept centralized so buttons/cards/inputs read as
// one system. Per the design spec: chrome stays neutral ink/grey; color is
// reserved for data (rings, graphs, good/bad deltas, the hold pill).
// Corners are sharp on purpose — 12px cards, 8px everything else, pills
// fully round only for small status chips. Linear/Ramp-compact, not lounge-y.

export const BTN_SOLID =
  "rounded-lg bg-ink px-3.5 py-1.5 text-[14px] font-medium text-bg transition hover:opacity-85 disabled:opacity-50";

export const BTN_GHOST =
  "rounded-lg border border-border px-3.5 py-1.5 text-[14px] font-medium text-ink-2 transition hover:border-border-strong hover:text-ink disabled:opacity-50";

export const BTN_DASHED =
  "rounded-lg border border-dashed border-border-strong px-3.5 py-1.5 text-[14px] font-medium text-ink-2 transition hover:border-ink-3 hover:text-ink";

// The one deliberately-accented button style (rev 03 §6 "key buttons") —
// used sparingly: Today's primary paycheck action, "Add budget", "Load demo
// data". Everything else stays BTN_SOLID (ink).
export const BTN_MOSS =
  "rounded-lg bg-moss px-3.5 py-1.5 text-[14px] font-medium text-bg transition hover:opacity-85 disabled:opacity-50";

export const LINK_QUIET = "text-[13px] text-ink-3 transition hover:text-ink";
export const LINK_QUIET_UNDERLINE = "text-[13px] text-ink-2 underline decoration-border-strong underline-offset-2 transition hover:text-ink hover:decoration-ink-3";

export const CARD = "rounded-xl border border-border bg-card p-4";
export const CARD_SOFT = "rounded-xl border border-border bg-card-soft p-4";
export const ROW = "rounded-lg border border-border bg-card p-3.5";

// Rev 04 §1.3: one header treatment for every card, everywhere — same
// size, same weight, sentence case, no emoji.
export const CARD_HEADER = "text-[15px] font-medium text-ink";

// Rev 04 §1.7/Rev 08 §2: every list-bearing card gets the same FIXED
// height (not a cap) + internal scroll — a short list doesn't collapse the
// card, a long one doesn't stretch it. `.scroll-list` (globals.css) hides
// the scrollbar track until hover and fades the bottom edge.
export const SCROLL_LIST = "h-[360px] overflow-y-auto pr-1 scroll-list";

// Rev 04 §1.6: the "est" marker for a variable/estimated bill, in its own
// column to the left of the amount so figures stay right-aligned. No badge
// at all = fixed.
export const EST_BADGE =
  "inline-flex h-4 items-center rounded border border-border-strong px-1 text-[10px] font-medium uppercase tracking-wide text-ink-3";

export const INPUT =
  "rounded-lg border border-border bg-card px-3 py-1.5 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-border-strong";

export const LABEL = "flex flex-col gap-1 text-[12.5px] text-ink-2";

export const PILL_HOLD =
  "inline-flex items-center gap-1.5 rounded-full bg-hold-bg px-3 py-1.5 text-[13px] font-medium text-hold";
