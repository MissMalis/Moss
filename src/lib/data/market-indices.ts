import { createClient } from "@/lib/supabase/server";

// Rev 09 §5.3.1: fixed display order — S&P 500 first, not alphabetical
// (the old `.order("label")` put "10Y" ahead of everything).
const SYMBOL_ORDER = ["SPX", "DJI", "IXIC", "RUT", "US10Y"];

/**
 * Today §2.1 ticker strip. Demo-seeded for now — see schema.sql's note on
 * why a live free-tier index feed isn't wired up (Finnhub's free tier
 * doesn't serve direct index-level quotes; an ETF-proxy workaround would
 * show a materially wrong absolute value, e.g. SPY's ~$550 share price
 * under the "S&P 500" label instead of its ~5,600 index level — worse
 * than clearly-labeled demo data). `updated_at` is still real and honest:
 * it reflects whenever this row was last written, so the "Updated H:MM"
 * display (TickerBar) surfaces staleness accurately either way.
 */
export async function listMarketIndices() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("market_indices").select("*");
  if (error) throw error;
  return [...data].sort((a, b) => SYMBOL_ORDER.indexOf(a.symbol) - SYMBOL_ORDER.indexOf(b.symbol));
}
