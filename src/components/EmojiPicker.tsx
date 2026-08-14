"use client";

import { useState } from "react";

// A curated set, not the OS picker — click to open, click to choose, no
// keyboard shortcut needed (brief rev 02 §2.4).
const EMOJI_OPTIONS = [
  "🍔", "☕", "🛒", "🍕", "🍺", "🥗",
  "🏠", "💡", "🚗", "⛽", "🚊", "✈️",
  "📺", "🎮", "🎵", "🎬", "📚", "🎁",
  "👕", "💊", "🏥", "🏋️", "🐾", "🎓",
  "📱", "💳", "🏦", "🌱", "🧾", "💰",
];

export function EmojiPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [open, setOpen] = useState(false);
  // No prefilled emoji (brief rev 02 §2.4) — an unset picker submits "" so
  // the record falls back to its type-based default, not a fake selection.
  const [value, setValue] = useState(defaultValue || "");

  return (
    <span className="relative inline-block">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose an emoji"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-[16px] hover:border-border-strong ${
          value ? "border-border" : "border-dashed border-border-strong text-ink-3 hover:border-ink-3"
        }`}
      >
        {value || "+"}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 grid w-[216px] grid-cols-6 gap-1 rounded-lg border border-border bg-card p-2 shadow-none">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setValue(e);
                setOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[15px] hover:bg-card-soft"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
