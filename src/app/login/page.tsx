"use client";

import { useActionState } from "react";
import { sendMagicLink, signInWithPassword } from "@/lib/actions/auth";

const initialPasswordState: { error?: string } = {};
const initialMagicLinkState: { error?: string; sent?: boolean } = {};

export default function LoginPage() {
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState(
    sendMagicLink,
    initialMagicLinkState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    initialPasswordState,
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl text-text mb-1">moss</h1>
        <p className="text-dim text-sm mb-8">Private finance, one login.</p>

        {magicLinkState.sent ? (
          <p className="rounded-lg border border-line bg-panel px-4 py-3 text-sm text-sage">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form action={magicLinkAction} className="space-y-3">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-line bg-panel px-4 py-3 text-text placeholder:text-faint outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={magicLinkPending}
              className="w-full rounded-lg bg-blood px-4 py-3 font-medium text-text transition hover:bg-blood-light disabled:opacity-60"
            >
              {magicLinkPending ? "Sending…" : "Send magic link"}
            </button>
            {magicLinkState.error && <p className="text-sm text-warn">{magicLinkState.error}</p>}
          </form>
        )}

        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-faint hover:text-dim">
            Use a password instead
          </summary>
          <div className="mt-3 space-y-3">
            <form action={passwordAction} className="space-y-3">
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-line bg-panel px-4 py-3 text-text placeholder:text-faint outline-none focus:border-gold"
              />
              <input
                type="password"
                name="password"
                required
                placeholder="Password"
                className="w-full rounded-lg border border-line bg-panel px-4 py-3 text-text placeholder:text-faint outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={passwordPending}
                className="w-full rounded-lg border border-line bg-panel2 px-4 py-3 font-medium text-text transition hover:border-gold disabled:opacity-60"
              >
                {passwordPending ? "Signing in…" : "Sign in"}
              </button>
              {passwordState.error && <p className="text-sm text-warn">{passwordState.error}</p>}
            </form>
            <p className="text-xs text-faint">
              Requires setting a password once from Terminal — skip this if you&apos;re not using
              Terminal, the magic link above works on its own.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}
