import { createClient } from "@/lib/supabase/server";

/** Closed pay periods only — live/upcoming windows are computed, not stored (brief §3). */
export async function listClosedPayPeriods() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_periods")
    .select("*")
    .eq("closed", true)
    .order("pay_date", { ascending: false });
  if (error) throw error;
  return data;
}

/** Pay dates in the last little while, for Today's "Recent" feed — income rows show up alongside spending. */
export async function listRecentPayPeriods(sinceISO: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_periods")
    .select("*")
    .gte("pay_date", sinceISO)
    .order("pay_date", { ascending: false });
  if (error) throw error;
  return data;
}
