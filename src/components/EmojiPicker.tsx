"use client";

import { useRef, useState } from "react";
import { IconGlyph } from "@/components/IconGlyph";

// Rev 04 §1.11: Notion-style — the full curated set (not a handful),
// searchable by keyword, plus an "upload an image" option. Click to open,
// click to choose, no OS shortcut, no prefilled default (brief rev 02 §2.4).
const EMOJI_OPTIONS: { e: string; k: string }[] = [
  // Food & drink
  { e: "🍔", k: "burger food" }, { e: "🍕", k: "pizza food" }, { e: "🌮", k: "taco food" },
  { e: "🍜", k: "noodles ramen food" }, { e: "🍣", k: "sushi food" }, { e: "🥗", k: "salad food healthy" },
  { e: "🍎", k: "apple food fruit" }, { e: "🥑", k: "avocado food" }, { e: "🍩", k: "donut food sweet" },
  { e: "🍰", k: "cake food sweet dessert" }, { e: "☕", k: "coffee drink" }, { e: "🍺", k: "beer drink" },
  { e: "🍷", k: "wine drink" }, { e: "🧋", k: "boba tea drink" }, { e: "🛒", k: "cart groceries shopping" },
  // Home & bills
  { e: "🏠", k: "home house rent" }, { e: "🏢", k: "building office" }, { e: "💡", k: "light bulb electric utility" },
  { e: "🔥", k: "gas heat fire utility" }, { e: "🚿", k: "water shower utility" }, { e: "🛋️", k: "furniture couch home" },
  { e: "🧺", k: "laundry basket home" }, { e: "🧹", k: "clean broom home" }, { e: "🔧", k: "repair tool maintenance" },
  { e: "📶", k: "wifi internet" }, { e: "📱", k: "phone mobile" }, { e: "📺", k: "tv subscriptions streaming" },
  // Transport
  { e: "🚗", k: "car transport" }, { e: "⛽", k: "gas fuel car" }, { e: "🚕", k: "taxi cab rideshare" },
  { e: "🚊", k: "train transit subway" }, { e: "🚌", k: "bus transit" }, { e: "✈️", k: "flight travel plane" },
  { e: "🚲", k: "bike transport" }, { e: "🅿️", k: "parking car" }, { e: "🛞", k: "tire car maintenance" },
  // Health
  { e: "💊", k: "medicine pharmacy health" }, { e: "🏥", k: "hospital doctor health" }, { e: "🦷", k: "dental teeth health" },
  { e: "🏋️", k: "gym fitness workout" }, { e: "🧘", k: "yoga wellness" }, { e: "🐾", k: "pet animal" },
  // Fun & entertainment
  { e: "🎮", k: "games fun entertainment" }, { e: "🎵", k: "music entertainment" }, { e: "🎬", k: "movies entertainment" },
  { e: "📚", k: "books reading" }, { e: "🎁", k: "gift present" }, { e: "🎨", k: "art hobby" },
  { e: "⚽", k: "sports fun" }, { e: "🎉", k: "party fun celebration" }, { e: "🎓", k: "school education tuition" },
  { e: "🧳", k: "travel luggage vacation" },
  // Shopping
  { e: "👕", k: "clothes shopping fashion" }, { e: "👟", k: "shoes shopping fashion" }, { e: "💄", k: "beauty shopping" },
  { e: "📦", k: "package amazon shipping delivery" }, { e: "🛍️", k: "shopping bag" },
  // Money & finance
  { e: "💳", k: "card credit payment" }, { e: "🏦", k: "bank savings" }, { e: "💰", k: "money savings" },
  { e: "💵", k: "cash money" }, { e: "📈", k: "invest growth stock" }, { e: "📉", k: "loss debt" },
  { e: "🧾", k: "receipt bill invoice" }, { e: "🪙", k: "coin money" }, { e: "💎", k: "value assets" },
  // Work & tech
  { e: "💼", k: "work job briefcase" }, { e: "💻", k: "laptop tech work" }, { e: "🖥️", k: "computer tech" },
  { e: "📅", k: "calendar schedule" }, { e: "✉️", k: "mail email" }, { e: "🔒", k: "security lock" },
  // People & misc
  { e: "👶", k: "baby kid childcare" }, { e: "👨‍👩‍👧", k: "family" }, { e: "🌱", k: "growth plant savings" },
  { e: "🌿", k: "nature plant" }, { e: "☀️", k: "sun weather" }, { e: "❤️", k: "heart love" },
  { e: "⭐", k: "star favorite" }, { e: "🔔", k: "bell alert reminder" }, { e: "🎯", k: "goal target budget" },
  { e: "🧧", k: "gift money envelope" }, { e: "🏛️", k: "government tax institution" }, { e: "🧓", k: "retirement senior" },
];

type Mode = "emoji" | "upload";
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

export function EmojiPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("emoji");
  const [query, setQuery] = useState("");
  // No prefilled emoji (brief rev 02 §2.4) — an unset picker submits "" so
  // the record falls back to its type-based default, not a fake selection.
  const [value, setValue] = useState(defaultValue || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? EMOJI_OPTIONS.filter((o) => o.k.includes(query.trim().toLowerCase()))
    : EMOJI_OPTIONS;

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
        <IconGlyph value={value} fallback="+" className="text-[16px]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[260px] rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="mb-2 flex gap-1 rounded-md bg-card-soft p-0.5 text-[12px]">
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
              Upload image
            </button>
          </div>

          {mode === "emoji" ? (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="mb-2 w-full rounded-md border border-border bg-card px-2 py-1 text-[12.5px] text-ink placeholder:text-ink-3 outline-none focus:border-border-strong"
              />
              <div className="grid max-h-[220px] grid-cols-6 gap-1 overflow-y-auto">
                {filtered.map((o) => (
                  <button
                    key={o.e}
                    type="button"
                    onClick={() => choose(o.e)}
                    title={o.k}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[15px] hover:bg-card-soft"
                  >
                    {o.e}
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
