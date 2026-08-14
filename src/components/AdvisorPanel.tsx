"use client";

import { useState } from "react";
import { BTN_SOLID, INPUT } from "@/lib/ui";
import { parseBoldSegments } from "@/lib/simple-markdown";

export function AdvisorPanel() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setPending(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
      } else {
        setAnswer(body.answer);
      }
    } catch {
      setError("Couldn't reach the advisor");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <form onSubmit={ask} className="flex flex-wrap items-end gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Can I afford to eat out this week?"
          className={`min-w-[180px] flex-1 ${INPUT}`}
        />
        <button type="submit" disabled={pending} className={BTN_SOLID}>
          {pending ? "…" : "Ask"}
        </button>
      </form>
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      {answer && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
          {parseBoldSegments(answer).map((seg, i) =>
            seg.bold ? (
              <strong key={i} className="font-medium text-ink">
                {seg.text}
              </strong>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
      )}
    </div>
  );
}
