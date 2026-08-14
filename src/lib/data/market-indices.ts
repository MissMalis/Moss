import { createClient } from "@/lib/supabase/server";

/** Today §2.1 ticker strip. Demo-seeded for now — see schema.sql's note on why a live free-tier index feed isn't wired up yet. */
export async function listMarketIndices() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("market_indices").select("*").order("label");
  if (error) throw error;
  return data;
}
