"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { BTN_SOLID, CARD } from "@/lib/ui";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className={`max-w-sm text-center ${CARD}`}>
        <p className="flex justify-center text-bad" aria-hidden>
          <TriangleAlert size={28} strokeWidth={2} />
        </p>
        <p className="mt-2 text-[15px] text-ink">Something went wrong</p>
        <p className="mt-1 text-[13px] text-ink-2">
          {error.message || "That action didn't go through."}
        </p>
        <button type="button" onClick={() => retry()} className={`mt-4 ${BTN_SOLID}`}>
          Try again
        </button>
      </div>
    </div>
  );
}
