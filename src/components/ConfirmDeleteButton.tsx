"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { BTN_GHOST } from "@/lib/ui";

const RED_BTN = "rounded-lg bg-bad px-3.5 py-1.5 text-[14px] font-medium text-bg transition hover:opacity-85";
const RED_LINK = "text-[13px] text-bad transition hover:opacity-80";

/**
 * Rev 05 §1.6/§0.1: every destructive action — a red button (or a plain
 * link inside a `⋯` menu) that always confirms first, and never crashes
 * the app if the delete itself fails (ActionForm catches the throw).
 */
export function ConfirmDeleteButton({
  action,
  hiddenFields,
  itemLabel = "this",
  label = "Remove",
  variant = "button",
}: {
  action: (formData: FormData) => Promise<void> | void;
  hiddenFields: Record<string, string>;
  itemLabel?: string;
  label?: string;
  variant?: "button" | "link";
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className={variant === "button" ? RED_BTN : RED_LINK}>
        {label}
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-medium text-ink">Delete {itemLabel}?</p>
            <p className="mt-1 text-[13px] text-ink-2">This can&apos;t be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={BTN_GHOST}>
                Cancel
              </button>
              <ActionForm action={action} onSuccess={() => setConfirming(false)}>
                {Object.entries(hiddenFields).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <button type="submit" className={RED_BTN}>
                  Delete
                </button>
              </ActionForm>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
