"use client";

import { useState } from "react";
import { BTN_SOLID, CARD } from "@/lib/ui";

/**
 * Rev 03 §6: "Add a ___" is always a button, never a toggle/disclosure. A
 * real <button> that reveals its form — not a <details>/<summary> pair,
 * which reads as a disclosure widget rather than an action.
 */
export function AddButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BTN_SOLID}>
        {label}
      </button>
    );
  }

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-2">{label}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-ink-3 hover:text-ink">
          Cancel
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
