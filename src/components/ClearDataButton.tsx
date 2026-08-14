"use client";

import { clearAllData } from "@/lib/actions/demo";
import { BTN_GHOST } from "@/lib/ui";

export function ClearDataButton() {
  return (
    <form
      action={clearAllData}
      onSubmit={(e) => {
        if (!confirm("This deletes everything — accounts, bills, cards, history. Are you sure?")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className={`${BTN_GHOST} border-bad/40 text-bad hover:border-bad`}>
        Clear all data
      </button>
    </form>
  );
}
