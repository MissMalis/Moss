import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSecret } from "@/lib/vault";

interface FinnhubQuote {
  c: number; // current price
  pc: number; // previous close
}

/**
 * GET /api/quotes?symbols=VTI,SCHD
 *
 * Pulls the market-data key from Vault, fetches live quotes (Finnhub's free
 * tier), and updates holdings.current_price for any matching symbols this
 * user holds. Returns the fetched quotes either way.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols") ?? "";
  const symbols = Array.from(
    new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
  if (symbols.length === 0) {
    return NextResponse.json({ error: "Pass ?symbols=VTI,SCHD" }, { status: 400 });
  }

  const apiKey = await getUserSecret(user.id, "market");
  if (!apiKey) {
    return NextResponse.json(
      { error: "No market data key connected — add one in Settings." },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
          { cache: "no-store" },
        );
        if (!res.ok) return { symbol, price: null as number | null };
        const quote = (await res.json()) as FinnhubQuote;
        const price = typeof quote.c === "number" && quote.c > 0 ? quote.c : null;
        return { symbol, price };
      } catch {
        return { symbol, price: null as number | null };
      }
    }),
  );

  const priceBySymbol = new Map(results.map((r) => [r.symbol, r.price]));

  const { data: holdings, error: holdingsError } = await supabase
    .from("holdings")
    .select("id, symbol")
    .in("symbol", symbols);
  if (holdingsError) {
    return NextResponse.json({ error: holdingsError.message }, { status: 500 });
  }

  await Promise.all(
    (holdings ?? []).map(async (h) => {
      const price = priceBySymbol.get(h.symbol);
      if (price == null) return;
      await supabase.from("holdings").update({ current_price: price }).eq("id", h.id);
    }),
  );

  return NextResponse.json({ quotes: results });
}
