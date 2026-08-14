"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A tab strip inside a section (rev 04 §6 — Expenses splits into pages). */
export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] transition ${
              active ? "border-moss font-medium text-moss" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
