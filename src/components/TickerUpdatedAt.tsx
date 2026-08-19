"use client";

import { useEffect, useState } from "react";

/**
 * Rev 09 §5.3.2: formatted client-side, same reason as Greeting.tsx —
 * a server-rendered "H:MM AM/PM" would reflect the SERVER's timezone,
 * not the user's.
 */
export function TickerUpdatedAt({ isoTimestamp }: { isoTimestamp: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(isoTimestamp);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only, formatting with the browser's local timezone (unavailable during SSR), not synchronizing external state
    setText(d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  }, [isoTimestamp]);

  if (!text) return null;
  return <span className="text-bg/40">Updated {text}</span>;
}
