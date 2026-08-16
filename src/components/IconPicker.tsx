"use client";

import { useRef, useState } from "react";
import { ICON_REGISTRY, EMOJI_REGISTRY, lucideKey, emojiKey } from "@/lib/icons";
import { IconCircle } from "@/components/IconCircle";

const ICON_KEYS = Object.keys(ICON_REGISTRY).sort();
const EMOJI_KEYS = Object.keys(EMOJI_REGISTRY).sort();

type Mode = "symbol" | "emoji" | "upload";
const OUTPUT_SIZE = 64;

const GREY = "#9CA3AF";
const COLOR_SWATCHES = [
  { name: "Grey", hex: GREY },
  { name: "Red", hex: "#d0492f" },
  { name: "Orange", hex: "#e8792e" },
  { name: "Yellow", hex: "#d8a020" },
  { name: "Green", hex: "#2e9e6b" },
  { name: "Teal", hex: "#2aa79b" },
  { name: "Blue", hex: "#2a78d6" },
  { name: "Purple", hex: "#7a5cc0" },
  { name: "Pink", hex: "#e87ba4" },
  { name: "Brown", hex: "#8a5a3b" },
];

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
 * Rev 05 §1.2 + Rev 07 #10: Notion-style icon picker — Symbol (curated
 * Lucide set) / Emoji / Custom-upload tabs, plus a color-swatch row: icons
 * render grey until a color is picked, then every icon in the grid (and
 * the trigger button) recolors to it, so you're choosing "which icon, in
 * this color" rather than getting a different color per icon.
 */
export function IconPicker({
  name,
  label = "Icon",
  defaultValue,
  colorName,
  defaultColor,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
  /** Optional: also submit the chosen swatch color under this field name. */
  colorName?: string;
  defaultColor?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("symbol");
  const [query, setQuery] = useState("");
  // No prefilled icon (brief rev 02 §2.4) — an unset picker submits "" so
  // the record falls back to its type-based default, not a fake selection.
  const [value, setValue] = useState(defaultValue || "");
  const [pickerColor, setPickerColor] = useState(defaultColor || GREY);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredIcons = query.trim()
    ? ICON_KEYS.filter((k) => k.includes(query.trim().toLowerCase()))
    : ICON_KEYS;
  const filteredEmoji = query.trim()
    ? EMOJI_KEYS.filter((k) => k.includes(query.trim().toLowerCase()))
    : EMOJI_KEYS;

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
      {colorName && <input type="hidden" name={colorName} value={pickerColor} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose an icon"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-card hover:border-border-strong ${
          value ? "border-border" : "border-dashed border-border-strong text-ink-3 hover:border-ink-3"
        }`}
      >
        {value ? (
          <IconCircle value={value} label={label} color={pickerColor} variant="tinted" size="sm" />
        ) : (
          <span className="text-[16px]">+</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[260px] rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="mb-2 flex gap-1 rounded-md bg-card-soft p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setMode("symbol")}
              className={`flex-1 rounded px-2 py-1 transition ${mode === "symbol" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
            >
              Symbol
            </button>
            <button
              type="button"
              onClick={() => setMode("emoji")}
              className={`flex-1 rounded px-2 py-1 transition ${mode === "emoji" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
            >
              Emoji
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 rounded px-2 py-1 transition ${mode === "upload" ? "bg-card text-ink shadow-sm" : "text-ink-3"}`}
            >
              Upload
            </button>
          </div>

          {mode !== "upload" && (
            <div className="mb-2 flex flex-wrap gap-1.5 rounded-md bg-card-soft p-1.5">
              {COLOR_SWATCHES.map((s) => (
                <button
                  key={s.hex}
                  type="button"
                  onClick={() => setPickerColor(s.hex)}
                  title={s.name}
                  aria-label={s.name}
                  aria-pressed={pickerColor === s.hex}
                  className={`h-5 w-5 shrink-0 rounded-full transition ${
                    pickerColor === s.hex ? "ring-2 ring-offset-1 ring-ink-2" : ""
                  }`}
                  style={{ background: s.hex }}
                />
              ))}
            </div>
          )}

          {mode === "symbol" ? (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="mb-2 w-full rounded-md border border-border bg-card px-2 py-1 text-[12.5px] text-ink placeholder:text-ink-3 outline-none focus:border-border-strong"
              />
              <div className="grid max-h-[220px] grid-cols-6 gap-1 overflow-y-auto">
                {filteredIcons.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => choose(lucideKey(k))}
                    title={k}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-card-soft"
                  >
                    <IconCircle value={lucideKey(k)} label={k} color={pickerColor} variant="tinted" size="sm" />
                  </button>
                ))}
                {filteredIcons.length === 0 && (
                  <p className="col-span-6 py-3 text-center text-[12px] text-ink-3">No matches</p>
                )}
              </div>
            </>
          ) : mode === "emoji" ? (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="mb-2 w-full rounded-md border border-border bg-card px-2 py-1 text-[12.5px] text-ink placeholder:text-ink-3 outline-none focus:border-border-strong"
              />
              <div className="grid max-h-[220px] grid-cols-6 gap-1 overflow-y-auto">
                {filteredEmoji.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => choose(emojiKey(EMOJI_REGISTRY[k]))}
                    title={k}
                    className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-card-soft"
                  >
                    <IconCircle value={emojiKey(EMOJI_REGISTRY[k])} label={k} color={pickerColor} variant="tinted" size="sm" />
                  </button>
                ))}
                {filteredEmoji.length === 0 && (
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
