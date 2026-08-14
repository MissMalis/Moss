import { createClient } from "@/lib/supabase/server";

export async function listBudgets() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budgets").select("*").order("category");
  if (error) throw error;
  return data;
}
