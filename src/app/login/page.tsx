"use client";

import { useActionState } from "react";
import { sendMagicLink, signInWithPassword } from "@/lib/actions/auth";
import { BTN_GHOST, BTN_SOLID, INPUT } from "@/lib/ui";

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-ink mb-1">
          moss
        </h1>
        <p className="text-ink-2 text-[14px] mb-8">Private finance, one login.</p>

        {magicLinkState.sent ? (
          <p className="rounded-2xl border border-border bg-card-soft px-4 py-3 text-[14px] text-good">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form action={magicLinkAction} className="space-y-3">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className={`w-full py-3 ${INPUT}`}
            />
            <button
              type="submit"
              disabled={magicLinkPending}
              className={`w-full py-3 ${BTN_SOLID}`}
            >
              {magicLinkPending ? "Sending…" : "Send magic link"}
            </button>
            {magicLinkState.error && <p className="text-[13px] text-bad">{magicLinkState.error}</p>}
          </form>
        )}

        <details className="mt-6">
          <summary className="cursor-pointer text-[13px] text-ink-3 hover:text-ink-2">
            Use a password instead
          </summary>
          <div className="mt-3 space-y-3">
            <form action={passwordAction} className="space-y-3">
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className={`w-full py-3 ${INPUT}`}
              />
              <input
                type="password"
                name="password"
                required
                placeholder="Password"
                className={`w-full py-3 ${INPUT}`}
              />
              <button
                type="submit"
                disabled={passwordPending}
                className={`w-full py-3 ${BTN_GHOST}`}
              >
                {passwordPending ? "Signing in…" : "Sign in"}
              </button>
              {passwordState.error && (
                <p className="text-[13px] text-bad">{passwordState.error}</p>
              )}
            </form>
            <p className="text-[12.5px] text-ink-3">
              Requires setting a password once from Terminal — skip this if you&apos;re not using
              Terminal, the magic link above works on its own.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}
