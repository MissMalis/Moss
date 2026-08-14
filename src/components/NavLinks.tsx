"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Rev 03 §6: active states get the whisper-light moss accent. */
export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`transition ${active ? "font-medium text-moss" : "hover:text-ink"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
