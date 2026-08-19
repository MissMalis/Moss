"use client";

import { useEffect, useState } from "react";

/**
 * Rev 09 §5.2: the Dashboard's greeting was computed server-side, so
 * `new Date().getHours()` reflected the SERVER's timezone, not the
 * user's — "Good morning" could show at 3pm local time depending on
 * where the server happens to run. Computed client-side instead, after
 * mount, so it always reflects the browser's actual local hour.
 */
function computeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting() {
  const [text, setText] = useState("Hello");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only, computing the browser's local hour (unavailable during SSR), not synchronizing external state
    setText(computeGreeting());
  }, []);
  return <>{text}</>;
}
