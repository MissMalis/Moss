"use client";

import { useState } from "react";
import { Leaf, X } from "lucide-react";
import { AdvisorPanel } from "@/components/AdvisorPanel";

export function FloatingAskMoss({ geminiConnected }: { geminiConnected: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 w-[min(360px,calc(100vw-2.5rem))] rounded-xl border border-border bg-card p-4 shadow-none">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-ink">Ask Moss</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-ink-3 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
          {geminiConnected ? (
            <AdvisorPanel />
          ) : (
            <p className="text-[12.5px] text-ink-3">
              Connect a Gemini key in Settings → Connections to ask Moss questions.
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Ask Moss" : "Open Ask Moss"}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-bg transition hover:opacity-85"
      >
        {open ? <X size={20} /> : <Leaf size={20} />}
      </button>
    </div>
  );
}
