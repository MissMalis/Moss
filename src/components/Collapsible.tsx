"use client";

import { useState } from "react";

/**
 * Rev 04 §1.1/§1.8/Rev 09 §6.2: a smoothly-animating expand/collapse —
 * native <details> snaps open/closed with no transition, so this uses the
 * grid-rows 0fr->1fr trick instead. Respects prefers-reduced-motion.
 *
 * Uncontrolled by default (own internal state, as before). Pass `open` +
 * `onToggle` to drive it externally — Net worth's "Expand all" needs one
 * shared state across every group row.
 */
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function toggle() {
    const next = !open;
    if (controlledOpen === undefined) setInternalOpen(next);
    onToggle?.(next);
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        {summary}
        <span
          aria-hidden
          className={`shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
