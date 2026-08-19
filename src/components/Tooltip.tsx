"use client";

import { useLayoutEffect, useRef, useState } from "react";

const EDGE_MARGIN = 8;

/**
 * Rev 09 §5.4: every `?` tooltip app-wide — centered on its trigger by
 * default, but a trigger near the left/right edge of the viewport (like
 * the confirm-paycheck helper) used to render the fixed-width bubble
 * partly off-screen since it had zero viewport awareness. Measured after
 * open (useLayoutEffect, before paint) and nudged inward by just enough
 * to stay fully on-screen — same clamp-to-viewport idea as the net-worth
 * graph's hover tooltip (components/NetWorthLines.tsx).
 */
export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [shiftPx, setShiftPx] = useState(0);

  useLayoutEffect(() => {
    if (!open || !tooltipRef.current) {
      setShiftPx(0);
      return;
    }
    const rect = tooltipRef.current.getBoundingClientRect();
    if (rect.left < EDGE_MARGIN) {
      setShiftPx(EDGE_MARGIN - rect.left);
    } else if (rect.right > window.innerWidth - EDGE_MARGIN) {
      setShiftPx(window.innerWidth - EDGE_MARGIN - rect.right);
    } else {
      setShiftPx(0);
    }
  }, [open]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        aria-label="What does this mean?"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border-strong text-[10px] leading-none text-ink-3 hover:border-ink-3 hover:text-ink-2"
      >
        ?
      </button>
      {open && (
        <span
          ref={tooltipRef}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 w-56 rounded-lg border border-border bg-ink px-3 py-2 text-[12.5px] leading-snug text-bg shadow-none"
          style={{ transform: `translateX(calc(-50% + ${shiftPx}px))` }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
