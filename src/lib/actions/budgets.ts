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

export async function createBudget(formData: FormData) {
  const { supabase, user } = await requireUser();
  const category = String(formData.get("category") ?? "").trim();
  const cap_amount = Number(formData.get("cap_amount") ?? 0);
  if (!category || cap_amount <= 0) throw new Error("Pick a category and a positive cap");

  const { error } = await supabase
    .from("budgets")
    .upsert({ user_id: user.id, category, cap_amount }, { onConflict: "user_id,category" });
  if (error) throw error;
  revalidatePath("/expenses");
}

export async function updateBudget(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const cap_amount = Number(formData.get("cap_amount") ?? 0);
  if (!id || cap_amount <= 0) throw new Error("Pick a positive cap");

  const { error } = await supabase.from("budgets").update({ cap_amount }).eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
}

export async function deleteBudget(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing budget id");

  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/expenses");
}
