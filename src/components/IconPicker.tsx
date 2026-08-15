"use client";

import { useRef, useState } from "react";
import { ICON_REGISTRY, lucideKey } from "@/lib/icons";
import { IconCircle } from "@/components/IconCircle";

const ICON_KEYS = Object.keys(ICON_REGISTRY).sort();

type Mode = "icon" | "upload";
const OUTPUT_SIZE = 64;

function centerCropToDataUrl(img: HTMLImageElement): string {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Rev 05 §1.2: Notion-style icon picker — a curated Lucide set (no emoji),
 * searchable, plus an "upload an image" option that center-crops to a
 * circle. Click to open, click to choose, no prefilled default.
 */
export function IconPicker({
  name,
  label = "Icon",
  defaultValue,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("icon");
  const [query, setQuery] = useState("");
  // No prefilled icon (brief rev 02 §2.4) — an unset picker submits "" so
  // the record falls back to its type-based default, not a fake selection.
  const [value, setValue] = useState(defaultValue || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? ICON_KEYS.filter((k) => k.includes(query.trim().toLowerCase()))
    : ICON_KEYS;

  function choose(v: string) {
    setValue(v);
    setOpen(false);
    setQuery("");
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cropped = centerCropToDataUrl(img);
        if (cropped) choose(cropped);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <span className="relative inline-block">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose an icon"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-card hover:border-border-strong ${
          value ? "border-border" : "border-dashed border-border-strong text-ink-3 hover:border-ink-3"
        }`}
      >
        {value ? <IconCircle value={value} label={label} variant="tinted" size="sm" /> : <span className="text-[16px]">+</span>}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[260px] rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="mb-2 flex gap-1 rounded-md bg-card-soft p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setMode("icon")}
              className={`flex-1 rounded px-2 py-1 transition ${mode === "icon" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
            >
              Icon
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 rounded px-2 py-1 transition ${mode === "upload" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
            >
              Upload image
            </button>
          </div>

          {mode === "icon" ? (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="mb-2 w-full rounded-md border border-border bg-card px-2 py-1 text-[12.5px] text-ink placeholder:text-ink-3 outline-none focus:border-border-strong"
              />
              <div className="grid max-h-[220px] grid-cols-6 gap-1 overflow-y-auto">
                {filtered.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => choose(lucideKey(k))}
                    title={k}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-card-soft"
                  >
                    <IconCircle value={lucideKey(k)} label={k} variant="tinted" size="sm" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-6 py-3 text-center text-[12px] text-ink-3">No matches</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-center text-[11.5px] text-ink-3">
                Picks the center square and resizes it to fit — no separate crop step yet.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-dashed border-border-strong px-3 py-1.5 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink"
              >
                Choose a photo
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
