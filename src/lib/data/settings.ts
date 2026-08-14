import { createClient } from "@/lib/supabase/server";

export async function getSettings() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  return (
    data ?? {
      user_id: user.id,
      bank: "Generic",
      biz_shift: "next" as const,
      early_pay_days: 0,
      demo_seeded: false,
      cash_app_card_id: null,
      gemini_key_set: false,
      market_key_set: false,
      created_at: new Date().toISOString(),
    }
  );
}
