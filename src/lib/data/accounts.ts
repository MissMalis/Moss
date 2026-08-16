import { createClient } from "@/lib/supabase/server";

// Re-exported for existing server-side callers — the values themselves
// live in a pure module so client components can import them without
// pulling this file's supabase/server dependency into the browser bundle.
export { ACCOUNT_TYPES, WIZARD_ACCOUNT_TYPES } from "@/lib/account-types";

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
