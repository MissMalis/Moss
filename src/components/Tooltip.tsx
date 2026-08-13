"use client";

import { useState } from "react";

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

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
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-ink px-3 py-2 text-[12.5px] leading-snug text-bg shadow-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}
