"use client";

import { useState } from "react";
import { createTransfer } from "@/lib/actions/transfers";
import { Dropdown } from "@/components/Dropdown";
import { BTN_SOLID, INPUT, LABEL } from "@/lib/ui";

// Rev 07 #6: was grey-on-grey (BTN_GHOST) and easy to miss — an outlined
// dark button gives it real visible weight without competing with the
// solid-filled Add asset/Add liability buttons beside it.
const BTN_OUTLINED_DARK =
  "rounded-lg border border-ink px-3.5 py-1.5 text-[14px] font-medium text-ink transition hover:bg-ink hover:text-bg";

export interface TransferAccountOption {
  id: string;
  name: string;
}

/** Rev 04 §4: the global "Move money" action — a popup, not a page. */
export function MoveMoneyButton({ accounts }: { accounts: TransferAccountOption[] }) {
  const [open, setOpen] = useState(false);

  if (accounts.length < 2) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BTN_OUTLINED_DARK}>
        Move money
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-medium text-ink">Move money</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-ink-3 hover:text-ink">
                ×
              </button>
            </div>
            <form
              action={createTransfer}
              onSubmit={() => setOpen(false)}
              className="flex flex-col gap-3"
            >
              <label className={LABEL}>
                From
                <Dropdown name="from_account_id" options={accounts.map((a) => ({ value: a.id, label: a.name }))} defaultValue={accounts[0]?.id} />
              </label>
              <label className={LABEL}>
                To
                <Dropdown name="to_account_id" options={accounts.map((a) => ({ value: a.id, label: a.name }))} defaultValue={accounts[1]?.id} />
              </label>
              <label className={LABEL}>
                Amount
                <input type="number" step="0.01" name="amount" required className={INPUT} />
              </label>
              <label className={LABEL}>
                Date
                <input type="date" name="transfer_date" defaultValue={new Date().toISOString().slice(0, 10)} className={INPUT} />
              </label>
              <button type="submit" className={`${BTN_SOLID} mt-1`}>
                Move money
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
