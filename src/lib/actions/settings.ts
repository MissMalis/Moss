"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const bank = String(formData.get("bank") ?? "Generic").trim() || "Generic";
  const biz_shiftRaw = String(formData.get("biz_shift") ?? "next");
  const biz_shift = (["none", "prior", "next"] as const).includes(
    biz_shiftRaw as "none" | "prior" | "next",
  )
    ? (biz_shiftRaw as "none" | "prior" | "next")
    : "next";

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, bank, biz_shift }, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/settings");
}
