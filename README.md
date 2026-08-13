# Moss

Private, single-user personal finance app. Next.js App Router + Supabase (Postgres + Auth) + Vercel.

## Setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor (creates tables, RLS policies, and a trigger that seeds a `settings` row on signup).
3. Enable email magic-link auth in Supabase Auth settings (it's on by default).
4. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page; server-only, never exposed to the browser. Used for Vault access (Gemini/market API keys) and the period-close job.
5. `npm install`
6. `npm run dev` — sign in with a magic link, then visit the app.

## Structure

- [`src/lib/periods.ts`](src/lib/periods.ts) — pay-period math ported verbatim from the build brief (§1). Covered by [`src/lib/periods.test.ts`](src/lib/periods.test.ts), which encodes the assertions in brief §6.
- [`src/lib/supabase/`](src/lib/supabase) — browser client, server client (RSC/Route Handlers), service-role client (Vault-only, server-only import guard), and the session-refresh proxy.
- [`src/proxy.ts`](src/proxy.ts) — Next.js 16 proxy (formerly `middleware.ts`); redirects unauthenticated requests to `/login`.
- [`supabase/schema.sql`](supabase/schema.sql) — full schema + RLS from build brief §2.
- Design tokens live as CSS variables in [`src/app/globals.css`](src/app/globals.css); Fraunces for display/numbers, Inter for UI, wired via `next/font`.

## Testing the money math

```bash
npm test
```

## Deploying

Push to a Git repo, import into Vercel, set the three env vars above as Vercel Project env vars (not `NEXT_PUBLIC_*` for the service role key).
