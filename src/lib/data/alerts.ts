import { createClient } from "@/lib/supabase/server";

export async function listDismissedAlertIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dismissed_alerts").select("alert_id");
  if (error) throw error;
  return new Set(data.map((d) => d.alert_id));
}
