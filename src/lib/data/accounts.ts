import { createClient } from "@/lib/supabase/server";

export const ACCOUNT_TYPES = [
  "Cash",
  "HYSA",
  "Stored-value",
  "HSA",
  "401(k)",
  "Roth IRA",
  "Traditional IRA",
  "Taxable Brokerage",
  "Liabilities",
] as const;

export async function listAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("type")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getAccount(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listHoldings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holdings")
    .select("*")
    .order("symbol");
  if (error) throw error;
  return data;
}

export async function listHoldingsForAccount(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holdings")
    .select("*")
    .eq("account_id", accountId)
    .order("symbol");
  if (error) throw error;
  return data;
}
