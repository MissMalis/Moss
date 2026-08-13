import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSecret } from "@/lib/vault";
import { getTodaySnapshot } from "@/lib/data/today";
import { getNetWorthSummary } from "@/lib/data/net-worth-summary";
import { listUnsweptCharges } from "@/lib/data/cards";
import { formatMoney } from "@/lib/format";

// Bump this if Google retires the model — keep it to one place.
const GEMINI_MODEL = "gemini-2.5-flash";

function buildContext(
  today: Awaited<ReturnType<typeof getTodaySnapshot>>,
  netWorth: Awaited<ReturnType<typeof getNetWorthSummary>>,
  pendingCardTotal: number,
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
  if (pendingCardTotal > 0) {
    lines.push(`${formatMoney(pendingCardTotal)} in credit-card charges are pending a sweep.`);
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

  const [today, netWorth, unswept] = await Promise.all([
    getTodaySnapshot(),
    getNetWorthSummary(),
    listUnsweptCharges(),
  ]);
  const pendingCardTotal = unswept.reduce((s, c) => s + c.amount, 0);
  const context = buildContext(today, netWorth, pendingCardTotal);

  const prompt = `You are a calm, concise personal-finance advisor inside a budgeting app called Moss. Answer the user's question using the numbers below. Be specific, use dollar amounts from the context, and keep it under 150 words — no disclaimers, no "consult a financial advisor" boilerplate.

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
