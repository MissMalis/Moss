// Shared chrome classnames — kept centralized so buttons/cards/inputs read as
// one system. Per the design spec: chrome stays neutral ink/grey; color is
// reserved for data (rings, graphs, good/bad deltas, the hold pill).

export const BTN_SOLID =
  "rounded-xl bg-ink px-4 py-2 text-[14px] font-medium text-bg transition hover:opacity-85 disabled:opacity-50";

export const BTN_GHOST =
  "rounded-xl border border-border px-4 py-2 text-[14px] font-medium text-ink-2 transition hover:border-border-strong hover:text-ink disabled:opacity-50";

export const BTN_DASHED =
  "rounded-xl border border-dashed border-border-strong px-4 py-2 text-[14px] font-medium text-ink-2 transition hover:border-ink-3 hover:text-ink";

export const LINK_QUIET = "text-[13px] text-ink-3 transition hover:text-ink";
export const LINK_QUIET_UNDERLINE = "text-[13px] text-ink-2 underline decoration-border-strong underline-offset-2 transition hover:text-ink hover:decoration-ink-3";

export const CARD = "rounded-[20px] border border-border bg-card p-5";
export const CARD_SOFT = "rounded-[20px] border border-border bg-card-soft p-5";
export const ROW = "rounded-2xl border border-border bg-card p-4";

export const INPUT =
  "rounded-xl border border-border bg-card px-3 py-2 text-[14px] text-ink placeholder:text-ink-3 outline-none focus:border-border-strong";

export const LABEL = "flex flex-col gap-1 text-[12.5px] text-ink-2";

export const PILL_HOLD =
  "inline-flex items-center gap-1.5 rounded-full bg-hold-bg px-3 py-1.5 text-[13px] font-medium text-hold";
