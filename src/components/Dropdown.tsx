"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { INPUT } from "@/lib/ui";

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
}

/**
 * Rev 07 #3: the one themed dropdown used everywhere instead of a native
 * `<select>` — same surface/border/radius as every text input, real hover
 * and focus states. Works both uncontrolled (name + defaultValue, for a
 * plain form submit) and controlled (value + onChange, for selects that
 * drive conditional UI).
 */
export function Dropdown({
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  className = "",
  disabled = false,
}: {
  name?: string;
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? value ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const current = value !== undefined ? value : internalValue;
  const currentOption = options.find((o) => o.value === current);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function choose(v: string) {
    if (value === undefined) setInternalValue(v);
    onChange?.(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 text-left transition hover:border-border-strong disabled:opacity-50 ${INPUT} ${className}`}
      >
        <span className={`truncate ${currentOption ? "text-ink" : "text-ink-3"}`}>{currentOption?.label ?? placeholder}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-max overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === current}
              onClick={() => choose(o.value)}
              className={`block w-full whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-[13px] transition hover:bg-card-soft ${
                o.value === current ? "font-medium text-ink" : "text-ink-2"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
