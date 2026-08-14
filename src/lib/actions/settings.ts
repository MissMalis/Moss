"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setUserSecret, deleteUserSecret, type ApiKeyType } from "@/lib/vault";

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
  const early_pay_days = Math.min(5, Math.max(0, Number(formData.get("early_pay_days") ?? 0) || 0));

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, bank, biz_shift, early_pay_days }, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/settings");
}

function keyFlagPatch(keyType: ApiKeyType, value: boolean) {
  return keyType === "gemini" ? { gemini_key_set: value } : { market_key_set: value };
}

export async function saveApiKey(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const keyType = String(formData.get("key_type") ?? "") as ApiKeyType;
  const value = String(formData.get("value") ?? "").trim();
  if (keyType !== "gemini" && keyType !== "market") throw new Error("Unknown key type");
  if (!value) throw new Error("Enter a key");

  await setUserSecret(user.id, keyType, value);

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, ...keyFlagPatch(keyType, true) }, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/settings");
}

export async function removeApiKey(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const keyType = String(formData.get("key_type") ?? "") as ApiKeyType;
  if (keyType !== "gemini" && keyType !== "market") throw new Error("Unknown key type");

  await deleteUserSecret(user.id, keyType);

  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, ...keyFlagPatch(keyType, false) }, { onConflict: "user_id" });
  if (error) throw error;

  revalidatePath("/settings");
}
