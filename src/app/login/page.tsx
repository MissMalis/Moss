"use client";

import { useActionState } from "react";
import { sendMagicLink } from "@/lib/actions/auth";

const initialState: { error?: string; sent?: boolean } = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl text-text mb-1">moss</h1>
        <p className="text-dim text-sm mb-8">Private finance, one login.</p>

        {state.sent ? (
          <p className="rounded-lg border border-line bg-panel px-4 py-3 text-sm text-sage">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-line bg-panel px-4 py-3 text-text placeholder:text-faint outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-blood px-4 py-3 font-medium text-text transition hover:bg-blood-light disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send magic link"}
            </button>
            {state.error && (
              <p className="text-sm text-warn">{state.error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
