import { createClient } from "@/lib/supabase/server";

export async function listCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data;
}

export async function listRecurringItems() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_items")
    .select("*")
    .order("day_of_month");
  if (error) throw error;
  return data;
}

/** All occurrence-state rows whose occ_date falls within [start, end]. */
export async function listOccurrencesInRange(start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select("*")
    .gte("occ_date", start)
    .lte("occ_date", end);
  if (error) throw error;
  return data;
}

/** Up to `limit` most recent posted actuals for a variable item, most-recent first. */
export async function listRecentActuals(recurringItemId: string, limit = 3) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select("actual_amount, occ_date")
    .eq("recurring_item_id", recurringItemId)
    .eq("posted", true)
    .not("actual_amount", "is", null)
    .order("occ_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((d) => d.actual_amount!).filter((v): v is number => v != null);
}
