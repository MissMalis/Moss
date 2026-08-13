import { createClient } from "@/lib/supabase/server";

export async function listIncomeSources() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function listDeductions() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("deductions").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function listPurchasesInRange(start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .gte("spent_on", start)
    .lte("spent_on", end)
    .order("spent_on", { ascending: false });
  if (error) throw error;
  return data;
}

/** Has this pay date already been posted (contributions credited to accounts)? */
export async function findPostedPayPeriod(incomeSourceId: string, payDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_periods")
    .select("*")
    .eq("income_source_id", incomeSourceId)
    .eq("pay_date", payDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}
