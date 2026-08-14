import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSecret } from "@/lib/vault";
import { getTodaySnapshot } from "@/lib/data/today";
import { getNetWorthSummary } from "@/lib/data/net-worth-summary";
import { listAccounts } from "@/lib/data/accounts";
import { listUnsweptCharges } from "@/lib/data/cards";
import { formatMoney } from "@/lib/format";

// Alias, not a pinned version — tracks Google's current Flash model instead
// of 404ing the moment a specific version gets retired. If you'd rather pin
// a specific version, swap this one constant for e.g. "gemini-3.6-flash".
const GEMINI_MODEL = "gemini-flash-latest";

function buildContext(
  today: Awaited<ReturnType<typeof getTodaySnapshot>>,
  netWorth: Awaited<ReturnType<typeof getNetWorthSummary>>,
  accounts: Awaited<ReturnType<typeof listAccounts>>,
  pendingCardTotal: number,
  bufferAccountName: string | null,
): string {
  const lines: string[] = [];
  if (today.window) {
    lines.push(`Current pay period: ${today.window.start} to ${today.window.end}.`);
    lines.push(`Safe to spend right now: ${formatMoney(today.safeToSpend)}.`);
    lines.push(`Income this period: ${formatMoney(today.income)}.`);
    lines.push(`Earmarked bills this period: ${formatMoney(today.earmarked)}.`);
    lines.push(`Purchases logged this period: ${formatMoney(today.purchasesTotal)}.`);
    if (today.autoReserve.reserve > 0) {
      lines.push(
        `Auto-reserve is holding back ${formatMoney(today.autoReserve.reserve)} for a future shortfall.`,
      );
    }
  } else {
    lines.push("No income source is set up yet.");
  }
  lines.push(`Net worth: ${formatMoney(netWorth.total)}.`);

  lines.push("Accounts:");
  for (const a of accounts) {
    const bits = [`${a.name} (${a.type}): ${formatMoney(a.balance)}`];
    if (a.apy_pct) bits.push(`${a.apy_pct}% APY`);
    if (a.apr_pct) bits.push(`${a.apr_pct}% APR`);
    if (a.is_forbidden_money) bits.push("this is the channeling/buffer account — reserved for card payoff, never spendable");
    lines.push(`- ${bits.join(", ")}`);
  }

  if (pendingCardTotal > 0) {
    lines.push(
      `${formatMoney(pendingCardTotal)} in rewards-card charges are pending a sweep into ${bufferAccountName ?? "the buffer account"}.`,
    );
  }
  return lines.join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let question = "";
  try {
    const body = await request.json();
    question = String(body?.question ?? "").trim();
  } catch {
    // no body / not JSON
  }
  if (!question) {
    return NextResponse.json({ error: "Ask a question" }, { status: 400 });
  }

  const apiKey = await getUserSecret(user.id, "gemini");
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Gemini key connected — add one in Settings." },
      { status: 400 },
    );
  }

  const [today, netWorth, accounts, unswept] = await Promise.all([
    getTodaySnapshot(),
    getNetWorthSummary(),
    listAccounts(),
    listUnsweptCharges(),
  ]);
  const pendingCardTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const bufferAccount = accounts.find((a) => a.is_forbidden_money) ?? null;
  const context = buildContext(today, netWorth, accounts, pendingCardTotal, bufferAccount?.name ?? null);

  const prompt = `You are a sharp, direct financial friend inside a budgeting app called Moss — not a customer-service bot. Answer the user's question using the numbers below.

How to answer:
- Lead with the answer/what they can actually do. Don't open by recapping what they spent or received — they already know that.
- When money is tight or a decision involves debt vs. saving/investing, reason like a CFP: compare the account's APR/APY. Paying down a balance at a given APR is a guaranteed return of roughly that rate; only weigh it against investing if you're not overstating the case ("could beat" or "is a toss-up", not "you'll get 8%"). Never promise a specific market return.
- The channeling/buffer account is reserved for paying off card charges — never suggest spending it, even if it has a balance sitting in it.
- Plain text only. No markdown (no **bold**, no bullet dashes) — just sentences.
- End with one short line noting this isn't licensed financial advice, only if the question involves a real financial decision (skip it for simple lookups like "what's my balance").
- Be specific with dollar amounts from the context. Keep it under 150 words.

Current numbers:
${context}

Question: ${question}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    if (res.status === 404) {
      return NextResponse.json(
        { error: "The advisor model needs updating — ping whoever maintains this app." },
        { status: 502 },
      );
    }
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Gemini request failed (${res.status}). ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const answer: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    "";

  if (!answer) {
    return NextResponse.json({ error: "Gemini returned no answer" }, { status: 502 });
  }

  return NextResponse.json({ answer });
}
