import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSecret } from "@/lib/vault";

interface FinnhubQuote {
  c: number; // current price
  pc: number; // previous close
}

// Rev 10 §3.1: Finnhub's free tier doesn't serve direct index-level quotes
// (see lib/data/market-indices.ts's note — this is the same constraint
// that kept the banner demo-seeded through Rev 09). It DOES serve regular
// equity/ETF quotes, though, and a highly-liquid, index-tracking ETF's
// percent move is a faithful stand-in for "how did the index move today."
// So: fetch the proxy's live % change, then apply that same % change to
// the INDEX's own stored prev_close — never the ETF's own price — so the
// displayed number always stays at the index's real scale (e.g. ~5,600
// for the S&P, not SPY's ~$550 share price) while still moving live with
// the real market. US10Y has no equity-ETF equivalent (it's a yield, not
// a price) and is left alone — not a fetch failure, just nothing to poll.
const PROXY_BY_SYMBOL: Record<string, string> = {
  SPX: "SPY",
  DJI: "DIA",
  IXIC: "QQQ",
  RUT: "IWM",
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = await getUserSecret(user.id, "market");
  if (!apiKey) {
    return NextResponse.json({ error: "No market data key connected — add one in Settings." }, { status: 400 });
  }

  const { data: rows, error: rowsErr } = await supabase.from("market_indices").select("*").eq("user_id", user.id);
  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

  await Promise.all(
    (rows ?? []).map(async (row) => {
      const proxy = PROXY_BY_SYMBOL[row.symbol];
      if (!proxy) return; // US10Y — nothing to poll, leave as-is.
      try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${proxy}&token=${apiKey}`, { cache: "no-store" });
        if (!res.ok) return;
        const quote = (await res.json()) as FinnhubQuote;
        if (typeof quote.c !== "number" || typeof quote.pc !== "number" || quote.pc <= 0) return;
        const pctChange = (quote.c - quote.pc) / quote.pc;
        const newValue = Math.round(row.prev_close * (1 + pctChange) * 100) / 100;
        await supabase.from("market_indices").update({ value: newValue, updated_at: new Date().toISOString() }).eq("id", row.id);
      } catch {
        // Fetch failed — leave this row's last good value untouched.
      }
    }),
  );

  const { data: refreshed, error: refreshedErr } = await supabase.from("market_indices").select("*").eq("user_id", user.id);
  if (refreshedErr) return NextResponse.json({ error: refreshedErr.message }, { status: 500 });
  return NextResponse.json({ indices: refreshed });
}
