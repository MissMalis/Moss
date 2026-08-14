"use client";

import { useState } from "react";

/**
 * Rev 04 §1.1/§1.8: a smoothly-animating expand/collapse — native
 * <details> snaps open/closed with no transition, so this uses the
 * grid-rows 0fr->1fr trick instead. Respects prefers-reduced-motion.
 */
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
