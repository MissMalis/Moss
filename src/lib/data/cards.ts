import { createClient } from "@/lib/supabase/server";

export async function listCards() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cards").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function listCardMultipliers() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("card_category_multipliers").select("*");
  if (error) throw error;
  return data;
}

export async function listUnsweptCharges() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_charges")
    .select("*")
    .eq("swept", false)
    .order("spent_on", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listRecentSweptCharges(limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_charges")
    .select("*")
    .eq("swept", true)
    .order("swept_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getForbiddenMoneyAccount() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_forbidden_money", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}
