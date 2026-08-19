"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { postOccurrence, unpostOccurrence } from "@/lib/actions/recurring";
import { BTN_GHOST, BTN_SOLID, INPUT } from "@/lib/ui";

const BOX = "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border text-[11px] transition";

/**
 * Rev 05 §5: mark-posted is a checkbox on the row, not hidden in the `⋯`
 * menu. A fixed bill posts on one click; a variable bill opens a small
 * popup asking for the actual amount first (that's what drives the
 * estimate→actual true-up).
 */
export function MarkPostedCheckbox({
  recurringItemId,
  occDate,
  isVariable,
  estimatedAmount,
  posted,
}: {
  recurringItemId: string;
  occDate: string;
  isVariable: boolean;
  estimatedAmount: number;
  posted: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (posted) {
    return (
      <ActionForm action={unpostOccurrence}>
        <input type="hidden" name="recurring_item_id" value={recurringItemId} />
        <input type="hidden" name="occ_date" value={occDate} />
        <button
          type="submit"
          aria-label="Posted — click to undo"
          title="Posted — click to undo"
          className={`${BOX} border-moss bg-moss text-bg`}
        >
          ✓
        </button>
      </ActionForm>
    );
  }

  if (!isVariable) {
    return (
      <ActionForm action={postOccurrence}>
        <input type="hidden" name="recurring_item_id" value={recurringItemId} />
        <input type="hidden" name="occ_date" value={occDate} />
        <button type="submit" aria-label="Mark posted" title="Mark posted" className={`${BOX} border-border-strong hover:border-moss`} />
      </ActionForm>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label="Mark posted"
        title="Mark posted"
        className={`${BOX} border-border-strong hover:border-moss`}
      />
      {asking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={() => setAsking(false)}>
          <div
            /* Rev 09 §8: one standard modal size everywhere. */
            className="w-full max-w-[480px] rounded-xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[13.5px] font-medium text-ink">What was the actual amount?</p>
            <ActionForm action={postOccurrence} onSuccess={() => setAsking(false)} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="recurring_item_id" value={recurringItemId} />
              <input type="hidden" name="occ_date" value={occDate} />
              <input
                type="number"
                step="0.01"
                name="actual_amount"
                autoFocus
                defaultValue={estimatedAmount}
                className={INPUT}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAsking(false)} className={BTN_GHOST}>
                  Cancel
                </button>
                <button type="submit" className={BTN_SOLID}>
                  Confirm
                </button>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
