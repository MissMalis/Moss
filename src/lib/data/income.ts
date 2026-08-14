import { createClient } from "@/lib/supabase/server";
import { resolveIncomeAmount } from "@/lib/today";

export async function listIncomeSources() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("income_sources")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function listIncomeAmountVersions(incomeSourceId?: string) {
  const supabase = await createClient();
  let query = supabase.from("income_amount_versions").select("*").order("effective_date");
  if (incomeSourceId) query = query.eq("income_source_id", incomeSourceId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Income sources with their effective-dated amount history attached (brief rev 02 §2.2). */
export async function listIncomeSourcesWithVersions() {
  const [sources, versions] = await Promise.all([listIncomeSources(), listIncomeAmountVersions()]);
  const versionsBySource = new Map<string, typeof versions>();
  for (const v of versions) {
    versionsBySource.set(v.income_source_id, [...(versionsBySource.get(v.income_source_id) ?? []), v]);
  }
  return sources.map((s) => ({
    ...s,
    amountVersions: versionsBySource.get(s.id) ?? [],
  }));
}

/** The amount that applies right now, per the effective-dated history. */
export function currentIncomeAmount(source: {
  net_per_check: number;
  amountVersions: { net_per_check: number; effective_date: string }[];
}): number {
  const todayISO = new Date().toISOString().slice(0, 10);
  return resolveIncomeAmount(source.amountVersions, todayISO, source.net_per_check);
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
