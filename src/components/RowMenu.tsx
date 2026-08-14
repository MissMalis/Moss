"use client";

import { useEffect, useRef, useState } from "react";

export interface RowMenuPopover {
  label: string;
  content: React.ReactNode;
}

/**
 * Rev 04 §1.4: row actions (edit, delete, skip, deactivate, ...) collapse
 * into one "⋯" menu instead of sitting inline. `children` are one-click
 * actions (usually small server-action forms). `popovers` are named items
 * that instead open a small form popover (e.g. "Mark posted" needing an
 * amount, "Edit once", "Edit going forward") — pass one or several.
 */
export function RowMenu({
  children,
  popovers = [],
}: {
  children?: React.ReactNode;
  popovers?: RowMenuPopover[];
}) {
  const [open, setOpen] = useState(false);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !activePopover) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setActivePopover(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, activePopover]);

  const active = popovers.find((p) => p.label === activePopover);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setActivePopover(null);
        }}
        aria-label="More actions"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[15px] leading-none text-ink-3 transition hover:bg-card-soft hover:text-ink"
      >
        ⋯
      </button>

      <div
        className={`absolute right-0 top-full z-20 mt-1 min-w-[160px] origin-top-right rounded-lg border border-border bg-card p-1 shadow-lg transition motion-reduce:transition-none ${
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {popovers.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setActivePopover(p.label);
              setOpen(false);
            }}
            className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink-2 transition hover:bg-card-soft hover:text-ink"
          >
            {p.label}
          </button>
        ))}
        <div className="[&_form]:contents [&_button]:block [&_button]:w-full [&_button]:rounded-md [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-left [&_button]:text-[13px] [&_button]:text-ink-2 [&_button]:transition hover:[&_button]:bg-card-soft hover:[&_button]:text-ink">
          {children}
        </div>
      </div>

      {active && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[90vw] rounded-lg border border-border bg-card p-3 shadow-lg transition motion-reduce:transition-none">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-ink">{active.label}</p>
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              aria-label="Close"
              className="text-ink-3 hover:text-ink"
            >
              ×
            </button>
          </div>
          {active.content}
        </div>
      )}
    </div>
  );
}
