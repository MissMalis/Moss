"use client";

import { useState } from "react";
import { BTN_SOLID } from "@/lib/ui";

/**
 * Rev 05 §1.5: every Add/Log/Edit opens a real centered dialog with a
 * dimmed backdrop — never an inline expanding panel.
 */
export function Modal({
  label,
  title,
  trigger,
  children,
}: {
  /** Simple case: a button with this text opens the modal. */
  label?: string;
  title: string;
  /** Advanced case: render your own trigger, given an `open` callback. */
  trigger?: (open: () => void) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={BTN_SOLID}>
          {label}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 transition motion-reduce:transition-none"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-medium text-ink">{title}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ink-3 hover:text-ink">
                ×
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
