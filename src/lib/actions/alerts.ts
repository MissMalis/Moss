"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Checking an alert off (rev 04 §2) — dismissed by its deterministic checklist id. */
export async function dismissAlert(formData: FormData) {
  const { supabase, user } = await requireUser();
  const alert_id = String(formData.get("alert_id") ?? "");
  if (!alert_id) throw new Error("Missing alert id");

  const { error } = await supabase
    .from("dismissed_alerts")
    .upsert({ user_id: user.id, alert_id }, { onConflict: "user_id,alert_id" });
  if (error) throw error;
  revalidatePath("/today");
}
